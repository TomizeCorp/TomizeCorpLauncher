package fr.tomizecorp.epsilon;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import java.io.Reader;
import java.io.Writer;
import java.lang.reflect.Type;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.block.MapColor;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.Heightmap;

public final class TomizeMap {
    public static final int MAP_SIZE = 108;
    public static final int MAP_RADIUS = 27;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Type WAYPOINT_LIST = new TypeToken<ArrayList<Waypoint>>() {}.getType();
    private static final Path FILE = FabricLoader.getInstance().getConfigDir().resolve("tomizecorp-waypoints.json");
    private static final List<Waypoint> WAYPOINTS = new ArrayList<>();
    private static boolean loaded;
    private static final int[] SURFACE = new int[MAP_RADIUS * 2 * MAP_RADIUS * 2];
    private static final int[] HEIGHTS = new int[MAP_RADIUS * 2 * MAP_RADIUS * 2];
    private static int cachedX = Integer.MIN_VALUE;
    private static int cachedZ = Integer.MIN_VALUE;
    private static String cachedDimension = "";
    private static long cachedAt;

    private TomizeMap() {}

    public static final class Waypoint {
        public String name;
        public int x;
        public int y;
        public int z;
        public String dimension;

        public Waypoint(String name, int x, int y, int z, String dimension) {
            this.name = name; this.x = x; this.y = y; this.z = z; this.dimension = dimension;
        }
    }

    public static List<Waypoint> waypoints() { load(); return WAYPOINTS; }
    public static String dimension(MinecraftClient client) { return client.world == null ? "" : client.world.getRegistryKey().getValue().toString(); }

    public static void addCurrent(MinecraftClient client, String name) {
        load();
        if (client.player == null || client.world == null || WAYPOINTS.size() >= 50) return;
        String clean = cleanName(name, "Ping " + (WAYPOINTS.size() + 1));
        WAYPOINTS.add(new Waypoint(clean, client.player.getBlockX(), client.player.getBlockY(), client.player.getBlockZ(), dimension(client)));
        save();
    }

    public static void rename(int index, String name) {
        load();
        if (index < 0 || index >= WAYPOINTS.size()) return;
        WAYPOINTS.get(index).name = cleanName(name, WAYPOINTS.get(index).name);
        save();
    }

    public static void remove(int index) {
        load();
        if (index < 0 || index >= WAYPOINTS.size()) return;
        WAYPOINTS.remove(index);
        save();
    }

    private static String cleanName(String value, String fallback) {
        String clean = value == null ? "" : value.strip().replaceAll("[\\r\\n\\t]", " ");
        if (clean.isEmpty()) clean = fallback;
        return clean.substring(0, Math.min(24, clean.length()));
    }

    public static void render(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null || client.world == null || client.options.hudHidden) return;
        load();
        int mapX = context.getScaledWindowWidth() - MAP_SIZE - 10;
        int mapY = 10;
        context.fill(mapX - 5, mapY - 5, mapX + MAP_SIZE + 5, mapY + MAP_SIZE + 5, 0xEE050605);
        context.fill(mapX - 3, mapY - 3, mapX + MAP_SIZE + 3, mapY + MAP_SIZE + 3, 0xFF8B7447);
        context.fill(mapX - 1, mapY - 1, mapX + MAP_SIZE + 1, mapY + MAP_SIZE + 1, 0xFF111411);
        int playerX = client.player.getBlockX();
        int playerZ = client.player.getBlockZ();
        int cell = 2;
        updateSurface(client, playerX, playerZ);
        for (int dz = -MAP_RADIUS; dz < MAP_RADIUS; dz++) {
            for (int dx = -MAP_RADIUS; dx < MAP_RADIUS; dx++) {
                int color = SURFACE[(dz + MAP_RADIUS) * (MAP_RADIUS * 2) + dx + MAP_RADIUS];
                int x = mapX + (dx + MAP_RADIUS) * cell;
                int y = mapY + (dz + MAP_RADIUS) * cell;
                context.fill(x, y, x + cell, y + cell, color);
            }
        }
        int centerX = mapX + MAP_SIZE / 2;
        int centerY = mapY + MAP_SIZE / 2;
        drawPlayerArrow(context, centerX, centerY, client.player.getYaw());
        context.drawCenteredTextWithShadow(client.textRenderer, "N", centerX, mapY + 2, 0xFFFFFFFF);
        context.drawCenteredTextWithShadow(client.textRenderer, "S", centerX, mapY + MAP_SIZE - 10, 0xFFFFFFFF);
        context.drawTextWithShadow(client.textRenderer, "O", mapX + 3, centerY - 4, 0xFFFFFFFF);
        context.drawTextWithShadow(client.textRenderer, "E", mapX + MAP_SIZE - 9, centerY - 4, 0xFFFFFFFF);

        String currentDimension = dimension(client);
        for (Waypoint waypoint : WAYPOINTS) {
            if (!currentDimension.equals(waypoint.dimension)) continue;
            int dx = waypoint.x - playerX;
            int dz = waypoint.z - playerZ;
            if (Math.abs(dx) >= MAP_RADIUS || Math.abs(dz) >= MAP_RADIUS) continue;
            int x = mapX + (dx + MAP_RADIUS) * cell;
            int y = mapY + (dz + MAP_RADIUS) * cell;
            context.fill(x - 2, y - 2, x + 3, y + 3, 0xFF111111);
            context.fill(x - 1, y - 1, x + 2, y + 2, 0xFFFF3BD4);
        }

        String coordinates = "X " + client.player.getBlockX() + "  Y " + client.player.getBlockY() + "  Z " + client.player.getBlockZ();
        int coordinateWidth = client.textRenderer.getWidth(coordinates);
        context.fill(mapX + MAP_SIZE - coordinateWidth - 6, mapY + MAP_SIZE + 6, mapX + MAP_SIZE + 3, mapY + MAP_SIZE + 19, 0xCC050505);
        context.drawTextWithShadow(client.textRenderer, coordinates, mapX + MAP_SIZE - coordinateWidth, mapY + MAP_SIZE + 8, 0xFFFFFFFF);

        List<Waypoint> nearest = WAYPOINTS.stream().filter(point -> currentDimension.equals(point.dimension))
                .sorted(Comparator.comparingDouble(point -> distance(client, point))).limit(4).toList();
        int lineY = mapY + MAP_SIZE + 23;
        for (Waypoint waypoint : nearest) {
            String label = "◆ " + waypoint.name + "  " + Math.round(distance(client, waypoint)) + " m";
            int width = client.textRenderer.getWidth(label);
            context.fill(mapX + MAP_SIZE - width - 6, lineY - 2, mapX + MAP_SIZE + 3, lineY + 10, 0xAA050505);
            context.drawTextWithShadow(client.textRenderer, label, mapX + MAP_SIZE - width, lineY, 0xFFFF7BE1);
            lineY += 12;
        }
        context.drawTextWithShadow(client.textRenderer, "B : GÉRER LES PINGS", mapX, mapY + MAP_SIZE - 11, 0xFFFFFFFF);
    }

    private static void updateSurface(MinecraftClient client, int playerX, int playerZ) {
        String currentDimension = dimension(client);
        long now = System.currentTimeMillis();
        if (currentDimension.equals(cachedDimension) && playerX == cachedX && playerZ == cachedZ && now - cachedAt < 1000) return;
        cachedX = playerX; cachedZ = playerZ; cachedDimension = currentDimension; cachedAt = now;
        for (int dz = -MAP_RADIUS; dz < MAP_RADIUS; dz++) {
            for (int dx = -MAP_RADIUS; dx < MAP_RADIUS; dx++) {
                int color = 0xFF202020;
                int top = client.world.getBottomY();
                try {
                    int worldX = playerX + dx, worldZ = playerZ + dz;
                    top = client.world.getTopY(Heightmap.Type.WORLD_SURFACE, worldX, worldZ);
                    BlockPos pos = new BlockPos(worldX, top - 1, worldZ);
                    MapColor mapColor = client.world.getBlockState(pos).getMapColor(client.world, pos);
                    color = 0xFF000000 | mapColor.color;
                } catch (RuntimeException ignored) { }
                int index = (dz + MAP_RADIUS) * (MAP_RADIUS * 2) + dx + MAP_RADIUS;
                SURFACE[index] = color;
                HEIGHTS[index] = top;
            }
        }
        int diameter = MAP_RADIUS * 2;
        for (int z = 0; z < diameter; z++) {
            for (int x = 0; x < diameter; x++) {
                int index = z * diameter + x;
                int reference = z > 0 ? HEIGHTS[(z - 1) * diameter + x] : HEIGHTS[index];
                int amount = Math.max(-28, Math.min(28, (HEIGHTS[index] - reference) * 7));
                SURFACE[index] = shade(SURFACE[index], amount);
            }
        }
    }

    private static int shade(int color, int amount) {
        int red = Math.max(0, Math.min(255, ((color >> 16) & 0xFF) + amount));
        int green = Math.max(0, Math.min(255, ((color >> 8) & 0xFF) + amount));
        int blue = Math.max(0, Math.min(255, (color & 0xFF) + amount));
        return 0xFF000000 | red << 16 | green << 8 | blue;
    }

    private static void drawPlayerArrow(DrawContext context, int x, int y, float yaw) {
        int direction = Math.floorMod(Math.round(yaw / 45.0F), 8);
        int[][] offsets = {
            { 0, -4, -2, 2, 2, 2 },
            { 3, -3, -2, 0, 0, 2 },
            { 4, 0, -2, -2, -2, 2 },
            { 3, 3, 0, -2, -2, 0 },
            { 0, 4, -2, -2, 2, -2 },
            { -3, 3, 0, -2, 2, 0 },
            { -4, 0, 2, -2, 2, 2 },
            { -3, -3, 0, 2, 2, 0 }
        };
        int[] points = offsets[direction];
        context.fill(x - 2, y - 2, x + 3, y + 3, 0xEE101010);
        context.fill(x + points[0] - 1, y + points[1] - 1, x + points[0] + 2, y + points[1] + 2, 0xFFFFFFFF);
        context.fill(x + points[2], y + points[3], x + points[2] + 2, y + points[3] + 2, 0xFFFFFFFF);
        context.fill(x + points[4], y + points[5], x + points[4] + 2, y + points[5] + 2, 0xFFFFFFFF);
    }

    private static double distance(MinecraftClient client, Waypoint point) {
        double dx = client.player.getX() - point.x, dy = client.player.getY() - point.y, dz = client.player.getZ() - point.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    private static void load() {
        if (loaded) return;
        loaded = true;
        if (!Files.isRegularFile(FILE)) return;
        try (Reader reader = Files.newBufferedReader(FILE)) {
            List<Waypoint> saved = GSON.fromJson(reader, WAYPOINT_LIST);
            if (saved != null) WAYPOINTS.addAll(saved.stream().limit(50).toList());
        } catch (Exception ignored) { }
    }

    public static void save() {
        try {
            Files.createDirectories(FILE.getParent());
            try (Writer writer = Files.newBufferedWriter(FILE)) { GSON.toJson(WAYPOINTS, WAYPOINT_LIST, writer); }
        } catch (Exception ignored) { }
    }
}
