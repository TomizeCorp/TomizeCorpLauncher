package fr.tomizecorp.epsilon.mixin;

import fr.tomizecorp.epsilon.TomizeMap;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.hud.InGameHud;
import net.minecraft.client.render.RenderTickCounter;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(InGameHud.class)
public abstract class InGameHudMixin {
    @Inject(method = "render", at = @At("TAIL"))
    private void tomize$renderMap(DrawContext context, RenderTickCounter tickCounter, CallbackInfo ci) {
        tomize$renderStatusBars(context);
        TomizeMap.render(context);
    }

    private void tomize$renderStatusBars(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null || client.options.hudHidden) return;

        int width = 220;
        int left = (context.getScaledWindowWidth() - width) / 2;
        int bottom = context.getScaledWindowHeight() - 36;
        int health = Math.max(0, Math.min(100, Math.round(client.player.getHealth() / client.player.getMaxHealth() * 100.0F)));
        int food = Math.max(0, Math.min(100, client.player.getHungerManager().getFoodLevel() * 5));
        int armor = Math.max(0, Math.min(100, client.player.getArmor() * 5));

        // Le panneau recouvre les anciennes icônes cœur/nourriture/armure.
        context.fill(left - 5, bottom - 49, left + width + 5, bottom + 1, 0xD4070B08);
        tomize$bar(context, client, left, bottom - 45, width, health, 0xFF43C463, "PV");
        tomize$bar(context, client, left, bottom - 30, width, food, 0xFFE5A93A, "NOURRITURE");
        tomize$bar(context, client, left, bottom - 15, width, armor, 0xFF4FA7E8, "ARMURE");
    }

    private void tomize$bar(DrawContext context, MinecraftClient client, int x, int y, int width, int value, int color, String label) {
        context.fill(x, y, x + width, y + 11, 0xFF111811);
        context.fill(x + 1, y + 1, x + width - 1, y + 10, 0xFF293029);
        int progress = Math.round((width - 2) * value / 100.0F);
        context.fill(x + 1, y + 1, x + 1 + progress, y + 10, color);
        context.fill(x, y, x + width, y + 1, 0xFFB99A5C);
        String text = value + "/100 " + label + "  (" + value + "%)";
        int textX = x + (width - client.textRenderer.getWidth(text)) / 2;
        context.drawTextWithShadow(client.textRenderer, text, textX, y + 2, 0xFFFFFFFF);
    }
}
