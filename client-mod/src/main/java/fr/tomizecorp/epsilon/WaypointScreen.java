package fr.tomizecorp.epsilon;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;

public final class WaypointScreen extends Screen {
    private static final int PAGE_SIZE = 6;
    private final int page;
    private int selected = -1;
    private TextFieldWidget nameField;
    private TextFieldWidget xField;
    private TextFieldWidget yField;
    private TextFieldWidget zField;
    private ButtonWidget colorButton;
    private int colorIndex = 14;
    private boolean pendingRefresh;

    public WaypointScreen() { this(0); }
    private WaypointScreen(int page) { super(Text.literal("Pings TomizeCorp")); this.page = Math.max(0, page); }

    @Override
    protected void init() {
        int center = width / 2;
        nameField = new TextFieldWidget(textRenderer, center - 120, 44, 240, 20, Text.literal("Nom du ping"));
        nameField.setMaxLength(24);
        nameField.setPlaceholder(Text.literal("Nom du ping"));
        addDrawableChild(nameField);

        MinecraftClient client = MinecraftClient.getInstance();
        int currentX = client.player == null ? 0 : client.player.getBlockX();
        int currentY = client.player == null ? 0 : client.player.getBlockY();
        int currentZ = client.player == null ? 0 : client.player.getBlockZ();
        xField = coordinateField(center - 120, 70, "X", currentX);
        yField = coordinateField(center - 38, 70, "Y", currentY);
        zField = coordinateField(center + 44, 70, "Z", currentZ);
        colorButton = addDrawableChild(ButtonWidget.builder(colorText(), button -> {
            colorIndex = (colorIndex + 1) % TomizeMap.PING_COLORS.length;
            colorButton.setMessage(colorText());
        }).dimensions(center - 120, 96, 240, 20).build());

        int start = page * PAGE_SIZE;
        int visible = Math.max(0, Math.min(PAGE_SIZE, TomizeMap.waypoints().size() - start));
        for (int index = 0; index < visible; index++) {
            int waypointIndex = start + index;
            TomizeMap.Waypoint waypoint = TomizeMap.waypoints().get(waypointIndex);
            String label = waypoint.name + "  [" + waypoint.x + ", " + waypoint.y + ", " + waypoint.z + "]";
            addDrawableChild(ButtonWidget.builder(Text.literal(label), button -> select(waypointIndex))
                    .dimensions(center - 150, 124 + index * 23, 300, 20).build());
        }
        int actionsY = Math.min(height - 86, 132 + visible * 23);
        addDrawableChild(ButtonWidget.builder(Text.literal("AJOUTER ICI"), button -> {
            String name = nameField.getText();
            try {
                int x = Integer.parseInt(xField.getText().strip());
                int y = Integer.parseInt(yField.getText().strip());
                int z = Integer.parseInt(zField.getText().strip());
                TomizeMap.add(client, name, x, y, z, TomizeMap.PING_COLORS[colorIndex]);
                pendingRefresh = true;
            } catch (NumberFormatException error) {
                if (client.player != null) {
                    client.player.sendMessage(Text.literal("Les coordonnées du ping sont invalides."), false);
                }
            }
        }).dimensions(center - 150, actionsY, 96, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("MODIFIER"), button -> {
            try {
                TomizeMap.update(selected, nameField.getText(),
                        Integer.parseInt(xField.getText().strip()),
                        Integer.parseInt(yField.getText().strip()),
                        Integer.parseInt(zField.getText().strip()),
                        TomizeMap.PING_COLORS[colorIndex]);
                refresh();
            } catch (NumberFormatException error) {
                if (client.player != null) client.player.sendMessage(Text.literal("Coordonnées invalides."), false);
            }
        }).dimensions(center - 48, actionsY, 96, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("SUPPRIMER"), button -> {
            TomizeMap.remove(selected); refresh();
        }).dimensions(center + 54, actionsY, 96, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("◀"), button -> MinecraftClient.getInstance().setScreen(new WaypointScreen(Math.max(0, page - 1))))
                .dimensions(center - 150, actionsY + 28, 46, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("PAGE " + (page + 1)), button -> {})
                .dimensions(center - 98, actionsY + 28, 196, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("▶"), button -> {
            if ((page + 1) * PAGE_SIZE < TomizeMap.waypoints().size()) MinecraftClient.getInstance().setScreen(new WaypointScreen(page + 1));
        }).dimensions(center + 104, actionsY + 28, 46, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("TERMINÉ"), button -> close())
                .dimensions(center - 75, actionsY + 56, 150, 20).build());
    }

    private void select(int index) {
        selected = index;
        if (index >= 0 && index < TomizeMap.waypoints().size()) {
            TomizeMap.Waypoint waypoint = TomizeMap.waypoints().get(index);
            nameField.setText(waypoint.name);
            xField.setText(Integer.toString(waypoint.x));
            yField.setText(Integer.toString(waypoint.y));
            zField.setText(Integer.toString(waypoint.z));
            for (int indexColor = 0; indexColor < TomizeMap.PING_COLORS.length; indexColor++) {
                if (TomizeMap.PING_COLORS[indexColor] == waypoint.color) colorIndex = indexColor;
            }
            colorButton.setMessage(colorText());
        }
    }

    private void refresh() {
        int lastPage = Math.max(0, (TomizeMap.waypoints().size() - 1) / PAGE_SIZE);
        MinecraftClient.getInstance().setScreen(new WaypointScreen(Math.min(page, lastPage)));
    }

    private TextFieldWidget coordinateField(int x, int y, String axis, int value) {
        TextFieldWidget field = new TextFieldWidget(textRenderer, x, y, 76, 20, Text.literal(axis));
        field.setMaxLength(12);
        field.setPlaceholder(Text.literal(axis));
        field.setText(Integer.toString(value));
        return addDrawableChild(field);
    }

    private Text colorText() {
        return Text.literal("COULEUR : " + TomizeMap.PING_COLOR_NAMES[colorIndex])
                .withColor(TomizeMap.PING_COLORS[colorIndex] & 0xFFFFFF);
    }

    @Override
    public void tick() {
        super.tick();
        if (pendingRefresh) {
            pendingRefresh = false;
            refresh();
        }
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float deltaTicks) {
        renderBackground(context, mouseX, mouseY, deltaTicks);
        super.render(context, mouseX, mouseY, deltaTicks);
        context.drawCenteredTextWithShadow(textRenderer, title, width / 2, 16, 0xFFFFFFFF);
        context.drawCenteredTextWithShadow(textRenderer, Text.literal("Nom, coordonnées et couleur du ping"), width / 2, 28, 0xFFAAAAAA);
    }
}
