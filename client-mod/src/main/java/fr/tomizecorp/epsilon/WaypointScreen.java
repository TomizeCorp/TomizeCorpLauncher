package fr.tomizecorp.epsilon;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;

public final class WaypointScreen extends Screen {
    private final int page;
    private int selected = -1;
    private TextFieldWidget nameField;
    private boolean pendingRefresh;

    public WaypointScreen() { this(0); }
    private WaypointScreen(int page) { super(Text.literal("Pings TomizeCorp")); this.page = Math.max(0, page); }

    @Override
    protected void init() {
        int center = width / 2;
        nameField = new TextFieldWidget(textRenderer, center - 120, 54, 240, 20, Text.literal("Nom du ping"));
        nameField.setMaxLength(24);
        nameField.setPlaceholder(Text.literal("Nom du ping"));
        addDrawableChild(nameField);
        int start = page * 8;
        int visible = Math.max(0, Math.min(8, TomizeMap.waypoints().size() - start));
        for (int index = 0; index < visible; index++) {
            int waypointIndex = start + index;
            TomizeMap.Waypoint waypoint = TomizeMap.waypoints().get(waypointIndex);
            String label = waypoint.name + "  [" + waypoint.x + ", " + waypoint.y + ", " + waypoint.z + "]";
            addDrawableChild(ButtonWidget.builder(Text.literal(label), button -> select(waypointIndex))
                    .dimensions(center - 150, 84 + index * 23, 300, 20).build());
        }
        int actionsY = Math.min(height - 86, 92 + visible * 23);
        addDrawableChild(ButtonWidget.builder(Text.literal("AJOUTER ICI"), button -> {
            MinecraftClient client = MinecraftClient.getInstance();
            String name = nameField.getText();
            try {
                TomizeMap.addCurrent(client, name);
                pendingRefresh = true;
            } catch (RuntimeException error) {
                if (client.player != null) {
                    client.player.sendMessage(Text.literal("Impossible d'ajouter ce ping."), false);
                }
            }
        }).dimensions(center - 150, actionsY, 96, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("RENOMMER"), button -> {
            TomizeMap.rename(selected, nameField.getText()); refresh();
        }).dimensions(center - 48, actionsY, 96, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("SUPPRIMER"), button -> {
            TomizeMap.remove(selected); refresh();
        }).dimensions(center + 54, actionsY, 96, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("◀"), button -> MinecraftClient.getInstance().setScreen(new WaypointScreen(Math.max(0, page - 1))))
                .dimensions(center - 150, actionsY + 28, 46, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("PAGE " + (page + 1)), button -> {})
                .dimensions(center - 98, actionsY + 28, 196, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("▶"), button -> {
            if ((page + 1) * 8 < TomizeMap.waypoints().size()) MinecraftClient.getInstance().setScreen(new WaypointScreen(page + 1));
        }).dimensions(center + 104, actionsY + 28, 46, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("TERMINÉ"), button -> close())
                .dimensions(center - 75, actionsY + 56, 150, 20).build());
    }

    private void select(int index) {
        selected = index;
        if (index >= 0 && index < TomizeMap.waypoints().size()) nameField.setText(TomizeMap.waypoints().get(index).name);
    }

    private void refresh() {
        int lastPage = Math.max(0, (TomizeMap.waypoints().size() - 1) / 8);
        MinecraftClient.getInstance().setScreen(new WaypointScreen(Math.min(page, lastPage)));
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
        context.drawCenteredTextWithShadow(textRenderer, title, width / 2, 22, 0xFFFFFFFF);
        context.drawCenteredTextWithShadow(textRenderer, Text.literal("Ajoutez, renommez ou supprimez vos pings personnels"), width / 2, 36, 0xFFAAAAAA);
    }
}
