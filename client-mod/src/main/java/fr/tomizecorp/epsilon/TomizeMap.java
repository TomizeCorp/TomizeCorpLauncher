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
import java.util.List;
import java.util.Objects;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.block.MapColor;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.Heightmap;
import net.minecraft.world.LightType;

public final class TomizeMap {
    public static final int MAP_SIZE = 84;
    public static final int MAP_RADIUS = 21;
    public static final int[] PING_COLORS = {
        0xFFF9FFFE, 0xFFF9801D, 0xFFC74EBD, 0xFF3AB3DA,
        0xFFFED83D, 0xFF80C71F, 0xFFF38BAA, 0xFF474F52,
        0xFF9D9D97, 0xFF169C9C, 0xFF8932B8, 0xFF3C44AA,
        0xFF835432, 0xFF5E7C16, 0xFFB02E26, 0xFF1D1D21
    };
    public static final String[] PING_COLOR_NAMES = {
        "Blanc", "Orange", "Magenta", "Bleu clair",
        "Jaune", "Vert clair", "Rose", "Gris foncé",
        "Gris clair", "Cyan", "Violet", "Bleu",
        "Marron", "Vert", "Rouge", "Noir"
    };
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
        public int color;

        public Waypoint(String name, int x, int y, int z, String dimension, int color) {
            this.name = name; this.x = x; this.y = y; this.z = z;
            this.dimension = dimension; this.color = color;
        }
    }

    public static List<Waypoint> waypoints() { load(); return WAYPOINTS; }
    public static String dimension(MinecraftClient client) { return client.world == null ? "" : client.world.getRegistryKey().getValue().toString(); }

    public static void addCurrent(MinecraftClient client, String name) {
        if (client.player == null) return;
        add(client, name, client.player.getBlockX(), client.player.getBlockY(),
                client.player.getBlockZ(), PING_COLORS[14]);
    }

    public static void add(MinecraftClient client, String name, int x, int y, int z, int color) {
        load();
        if (client.world == null || WAYPOINTS.size() >= 50) return;
        String clean = cleanName(name, "Ping " + (WAYPOINTS.size() + 1));
        WAYPOINTS.add(new Waypoint(clean, x, y, z, dimension(client), color));
        save();
    }

    public static void rename(int index, String name) {
        load();
        if (index < 0 || index >= WAYPOINTS.size()) return;
        WAYPOINTS.get(index).name = cleanName(name, WAYPOINTS.get(index).name);
        save();
    }

    public static void update(int index, String name, int x, int y, int z, int color) {
        load();
        if (index < 0 || index >= WAYPOINTS.size()) return;
        Waypoint point = WAYPOINTS.get(index);
        point.name = cleanName(name, point.name);
        point.x = x; point.y = y; point.z = z; point.color = color;
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
        int mapX = context.getScaledWindowWidth() - MAP_SIZE - 12;
        int mapY = 12;
        int centerX = mapX + MAP_SIZE / 2;
        int centerY = mapY + MAP_SIZE / 2;
        fillCircle(context, centerX + 2, centerY + 3, MAP_SIZE / 2 + 5, 0x77000000);
        fillCircle(context, centerX, centerY, MAP_SIZE / 2 + 4, 0xFF151815);
        fillCircle(context, centerX, centerY, MAP_SIZE / 2 + 3, 0xFF7D847A);
        fillCircle(context, centerX, centerY, MAP_SIZE / 2 + 1, 0xFF252B25);
        int playerX = client.player.getBlockX();
        int playerZ = client.player.getBlockZ();
        int cell = 2;
        updateSurface(client, playerX, playerZ);
        for (int dz = -MAP_RADIUS; dz < MAP_RADIUS; dz++) {
            for (int dx = -MAP_RADIUS; dx < MAP_RADIUS; dx++) {
                if (dx * dx + dz * dz > (MAP_RADIUS - 1) * (MAP_RADIUS - 1)) continue;
                int color = SURFACE[(dz + MAP_RADIUS) * (MAP_RADIUS * 2) + dx + MAP_RADIUS];
                int x = mapX + (dx + MAP_RADIUS) * cell;
                int y = mapY + (dz + MAP_RADIUS) * cell;
                context.fill(x, y, x + cell, y + cell, color);
            }
        }
        drawPlayerArrow(context, centerX, centerY, client.player.getYaw());
        context.drawCenteredTextWithShadow(client.textRenderer, "N", centerX, mapY - 3, 0xFFFFFFFF);
        context.drawCenteredTextWithShadow(client.textRenderer, "S", centerX, mapY + MAP_SIZE - 6, 0xFFFFFFFF);
        context.drawTextWithShadow(client.textRenderer, "O", mapX - 2, centerY - 4, 0xFFFFFFFF);
        context.drawTextWithShadow(client.textRenderer, "E", mapX + MAP_SIZE - 5, centerY - 4, 0xFFFFFFFF);

        String currentDimension = dimension(client);
        for (Waypoint waypoint : WAYPOINTS) {
            if (!currentDimension.equals(waypoint.dimension)) continue;
            int dx = waypoint.x - playerX;
            int dz = waypoint.z - playerZ;
            if (Math.abs(dx) >= MAP_RADIUS || Math.abs(dz) >= MAP_RADIUS) continue;
            int x = mapX + (dx + MAP_RADIUS) * cell;
            int y = mapY + (dz + MAP_RADIUS) * cell;
            context.fill(x - 2, y - 2, x + 3, y + 3, 0xFF111111);
            context.fill(x - 1, y - 1, x + 2, y + 2, waypoint.color);
        }

        String coordinates = client.player.getBlockX() + ", " + client.player.getBlockY() + ", " + client.player.getBlockZ();
        int coordinateWidth = client.textRenderer.getWidth(coordinates);
        int infoCenter = mapX + MAP_SIZE / 2;
        context.fill(infoCenter - coordinateWidth / 2 - 4, mapY + MAP_SIZE + 5,
                infoCenter + coordinateWidth / 2 + 4, mapY + MAP_SIZE + 17, 0xAA000000);
        context.drawCenteredTextWithShadow(client.textRenderer, coordinates, infoCenter, mapY + MAP_SIZE + 7, 0xFFFFFFFF);
        String biome = client.world.getBiome(client.player.getBlockPos()).getIdAsString()
                .replace("minecraft:", "").replace('_', ' ');
        int blockLight = client.world.getLightLevel(LightType.BLOCK, client.player.getBlockPos());
        context.drawCenteredTextWithShadow(client.textRenderer, biome + "  BL: " + blockLight,
                infoCenter, mapY + MAP_SIZE + 19, 0xFFD8D8D8);
        String key = TomizeKeyBindings.WAYPOINTS.getBoundKeyLocalizedText().getString();
        context.drawCenteredTextWithShadow(client.textRenderer, key + " : PINGS",
                centerX, mapY + MAP_SIZE - 14, 0xFFE8ECE8);
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
                    int blockLight = client.world.getLightLevel(LightType.BLOCK, pos.up());
                    if (blockLight >= 10) color = warmLight(color, blockLight);
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

    private static int warmLight(int color, int level) {
        int strength = Math.min(72, (level - 8) * 12);
        int red = Math.min(255, ((color >> 16) & 0xFF) + strength);
        int green = Math.min(255, ((color >> 8) & 0xFF) + strength * 3 / 4);
        int blue = Math.min(255, (color & 0xFF) + strength / 4);
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
        context.fill(x - 2, y - 2, x + 3, y + 3, 0xDD101010);
        context.fill(x + points[0] - 1, y + points[1] - 1, x + points[0] + 2, y + points[1] + 2, 0xFFFF3030);
        context.fill(x + points[2], y + points[3], x + points[2] + 2, y + points[3] + 2, 0xFFFFFFFF);
        context.fill(x + points[4], y + points[5], x + points[4] + 2, y + points[5] + 2, 0xFFFFFFFF);
    }

    private static void fillCircle(DrawContext context, int centerX, int centerY, int radius, int color) {
        for (int y = -radius; y <= radius; y++) {
            int halfWidth = (int) Math.sqrt(radius * radius - y * y);
            context.fill(centerX - halfWidth, centerY + y, centerX + halfWidth + 1, centerY + y + 1, color);
        }
    }

    private static void load() {
        if (loaded) return;
        loaded = true;
        if (!Files.isRegularFile(FILE)) return;
        try (Reader reader = Files.newBufferedReader(FILE)) {
            List<Waypoint> saved = GSON.fromJson(reader, WAYPOINT_LIST);
            if (saved != null) {
                saved.stream().filter(Objects::nonNull).limit(50).forEach(point -> {
                    point.name = cleanName(point.name, "Ping");
                    if (point.dimension == null) point.dimension = "";
                    if (point.color == 0) point.color = PING_COLORS[14];
                    WAYPOINTS.add(point);
                });
            }
        } catch (Exception ignored) { }
    }

    public static void save() {
        try {
            Files.createDirectories(FILE.getParent());
            try (Writer writer = Files.newBufferedWriter(FILE)) { GSON.toJson(WAYPOINTS, WAYPOINT_LIST, writer); }
        } catch (Exception ignored) { }
    }
}
