package fr.tomizecorp.epsilon.mixin;

import fr.tomizecorp.epsilon.EpsilonBranding;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.TitleScreen;
import net.minecraft.client.gui.screen.multiplayer.ConnectScreen;
import net.minecraft.client.gui.screen.option.OptionsScreen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.network.ServerAddress;
import net.minecraft.client.network.ServerInfo;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.Redirect;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(TitleScreen.class)
public abstract class TitleScreenMixin extends Screen {
    protected TitleScreenMixin(Text title) { super(title); }

    @Inject(method = "init", at = @At("TAIL"))
    private void epsilon$lockMenu(CallbackInfo ci) {
        clearChildren();
        int left = width / 2 - 100;
        int top = height / 2 + 4;
        addDrawableChild(ButtonWidget.builder(Text.translatable("menu.epsilon.play"), button -> epsilon$connect()).dimensions(left, top, 200, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.translatable("menu.epsilon.options"), button -> {
            MinecraftClient client = MinecraftClient.getInstance();
            client.setScreen(new OptionsScreen(this, client.options));
        }).dimensions(left, top + 28, 200, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.translatable("menu.epsilon.quit"), button -> MinecraftClient.getInstance().scheduleStop()).dimensions(left, top + 56, 200, 20).build());
    }

    @Inject(
        method = "render",
        at = @At(
            value = "INVOKE",
            target = "Lnet/minecraft/client/gui/screen/Screen;render(Lnet/minecraft/client/gui/DrawContext;IIF)V",
            shift = At.Shift.BEFORE
        ),
        require = 0
    )
    private void epsilon$renderBlueMenuPanel(DrawContext context, int mouseX, int mouseY, float deltaTicks, CallbackInfo ci) {
        epsilon$drawPanelAroundButtons(context);
    }

    private void epsilon$drawPanelAroundButtons(DrawContext context) {
        int minX = Integer.MAX_VALUE;
        int minY = Integer.MAX_VALUE;
        int maxX = Integer.MIN_VALUE;
        int maxY = Integer.MIN_VALUE;
        for (var child : children()) {
            if (child instanceof ButtonWidget button) {
                minX = Math.min(minX, button.getX());
                minY = Math.min(minY, button.getY());
                maxX = Math.max(maxX, button.getX() + button.getWidth());
                maxY = Math.max(maxY, button.getY() + button.getHeight());
            }
        }
        if (minX == Integer.MAX_VALUE) return;
        epsilon$drawBluePanel(context, minX - 12, minY - 12, maxX + 12, maxY + 12);
    }

    private void epsilon$drawBluePanel(DrawContext context, int left, int top, int right, int bottom) {
        context.fill(left - 2, top - 2, right + 2, bottom + 2, 0xE5121D4E);
        context.fill(left, top, right, bottom, 0xE51B2A70);
        context.fill(left + 2, top + 2, right - 2, bottom - 2, 0xE5435EE8);
        context.fill(left + 4, top + 4, right - 4, bottom - 4, 0xF0121D4E);
        context.fill(left + 4, top + 4, right - 4, top + 6, 0xFFAEBAF7);
    }

    @Redirect(
        method = "render",
        at = @At(
            value = "INVOKE",
            target = "Lnet/minecraft/client/gui/DrawContext;drawTextWithShadow(Lnet/minecraft/client/font/TextRenderer;Ljava/lang/String;III)V"
        ),
        require = 0
    )
    private void epsilon$removeTechnicalVersion(DrawContext context, TextRenderer renderer, String text, int x, int y, int color) {
        if (epsilon$isTechnicalVersion(text)) return;
        context.drawTextWithShadow(renderer, text, x, y, color);
    }

    @Redirect(
        method = "render",
        at = @At(
            value = "INVOKE",
            target = "Lnet/minecraft/client/gui/DrawContext;drawTextWithShadow(Lnet/minecraft/client/font/TextRenderer;Lnet/minecraft/text/Text;III)V"
        ),
        require = 0
    )
    private void epsilon$removeTechnicalVersionText(DrawContext context, TextRenderer renderer, Text text, int x, int y, int color) {
        if (epsilon$isTechnicalVersion(text == null ? null : text.getString())) return;
        context.drawTextWithShadow(renderer, text, x, y, color);
    }

    private boolean epsilon$isTechnicalVersion(String text) {
        String normalized = text == null ? "" : text.toLowerCase();
        return normalized.contains("minecraft 1.21.11")
            || normalized.contains("tomizecorp/fabric")
            || normalized.contains("fabric")
            || normalized.contains("version modd");
    }

    private void epsilon$connect() {
        MinecraftClient client = MinecraftClient.getInstance();
        ServerAddress address = ServerAddress.parse(EpsilonBranding.SERVER);
        ServerInfo info = new ServerInfo("EPSILON", EpsilonBranding.SERVER, ServerInfo.ServerType.OTHER);
        ConnectScreen.connect(this, client, address, info, false, null);
    }
}
