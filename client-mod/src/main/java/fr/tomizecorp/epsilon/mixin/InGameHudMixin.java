package fr.tomizecorp.epsilon.mixin;

import fr.tomizecorp.epsilon.TomizeMap;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.hud.InGameHud;
import net.minecraft.client.render.RenderTickCounter;
import net.minecraft.entity.player.PlayerEntity;
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

    @Inject(method = "renderArmor", at = @At("HEAD"), cancellable = true)
    private static void tomize$hideVanillaArmor(
            DrawContext context, PlayerEntity player, int i, int j, int k, int x, CallbackInfo ci) {
        ci.cancel();
    }

    @Inject(method = "renderFood", at = @At("HEAD"), cancellable = true)
    private void tomize$hideVanillaFood(
            DrawContext context, PlayerEntity player, int top, int right, CallbackInfo ci) {
        ci.cancel();
    }

    @Inject(method = "renderHealthBar", at = @At("HEAD"), cancellable = true)
    private void tomize$hideVanillaHealth(
            DrawContext context, PlayerEntity player, int x, int y, int lines, int regeneratingHeartIndex,
            float maxHealth, int lastHealth, int health, int absorption, boolean blinking, CallbackInfo ci) {
        ci.cancel();
    }

    private void tomize$renderStatusBars(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null || client.options.hudHidden) return;

        int center = context.getScaledWindowWidth() / 2;
        int bottom = context.getScaledWindowHeight();
        int width = 82;
        int statusY = bottom - 40;
        int health = Math.max(0, Math.min(100,
                Math.round(client.player.getHealth() / client.player.getMaxHealth() * 100.0F)));
        int food = Math.max(0, Math.min(100, client.player.getHungerManager().getFoodLevel() * 5));
        int armor = Math.max(0, Math.min(100, client.player.getArmor() * 5));

        tomize$bar(context, client, center - 91, statusY, width, health, 0xFFE64141, "PV");
        tomize$bar(context, client, center + 9, statusY, width, food, 0xFFE5A93A, "FAIM");
        if (armor > 0) {
            tomize$bar(context, client, center + 9, statusY - 11, width, armor, 0xFF73A9E8, "ARMURE");
        }

        PlayerEntity tracked = tomize$nearestVisiblePlayer(client);
        if (tracked != null) {
            int trackedHealth = Math.max(0, Math.min(100,
                    Math.round(tracked.getHealth() / tracked.getMaxHealth() * 100.0F)));
            tomize$playerBar(context, client, center - 91, bottom - 32, 182, trackedHealth, tracked);
        }
    }

    private void tomize$bar(
            DrawContext context, MinecraftClient client, int x, int y, int width,
            int value, int color, String label) {
        context.fill(x, y, x + width, y + 8, 0xEE080A09);
        context.fill(x + 1, y + 1, x + width - 1, y + 7, 0xFF252A27);
        int progress = Math.round((width - 2) * value / 100.0F);
        context.fill(x + 1, y + 1, x + 1 + progress, y + 7, color);
        context.fill(x, y, x + width, y + 1, 0xFFB99A5C);
        String text = label + " " + value + "%";
        int textX = x + (width - client.textRenderer.getWidth(text)) / 2;
        context.drawTextWithShadow(client.textRenderer, text, textX, y - 1, 0xFFFFFFFF);
    }

    private void tomize$playerBar(
            DrawContext context, MinecraftClient client, int x, int y, int width,
            int value, PlayerEntity player) {
        context.fill(x, y, x + width, y + 5, 0xFF080A09);
        context.fill(x + 1, y + 1, x + width - 1, y + 4, 0xFF252A27);
        int progress = Math.round((width - 2) * value / 100.0F);
        context.fill(x + 1, y + 1, x + 1 + progress, y + 4, 0xFFE64141);
        String label = player.getName().getString() + "  " + value + "%";
        int textX = x + (width - client.textRenderer.getWidth(label)) / 2;
        context.drawTextWithShadow(client.textRenderer, label, textX, y - 9, 0xFFFFFFFF);
    }

    private PlayerEntity tomize$nearestVisiblePlayer(MinecraftClient client) {
        if (client.world == null || client.player == null) return null;
        return client.world.getPlayers().stream()
                .filter(player -> player != client.player)
                .filter(player -> !player.isSneaking())
                .filter(player -> player.squaredDistanceTo(client.player) <= 16.0D * 16.0D)
                .min((first, second) -> Double.compare(
                        first.squaredDistanceTo(client.player),
                        second.squaredDistanceTo(client.player)))
                .orElse(null);
    }
}
