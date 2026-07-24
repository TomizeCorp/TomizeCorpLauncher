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
        int width = 88;
        int statusY = bottom - 42;
        int health = Math.max(0, Math.min(100,
                Math.round(client.player.getHealth() / client.player.getMaxHealth() * 100.0F)));
        int food = Math.max(0, Math.min(100, client.player.getHungerManager().getFoodLevel() * 5));
        int armor = Math.max(0, Math.min(100, client.player.getArmor() * 5));

        tomize$bar(context, client, center - 91, statusY, width, health, 0xFF9E2925, 0xFFD05A47, "PV");
        tomize$bar(context, client, center + 3, statusY, width, food, 0xFF9B651D, 0xFFD69C3D, "FAIM");
        if (armor > 0) {
            tomize$bar(context, client, center + 3, statusY - 12, width, armor, 0xFF496B7C, 0xFF88AEBB, "ARMURE");
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
            int value, int darkColor, int lightColor, String label) {
        // Ombre, bois sculpté et filet de laiton vieilli.
        context.fill(x - 3, y - 1, x + width + 3, y + 11, 0x88000000);
        context.fill(x - 2, y - 2, x + width + 2, y + 10, 0xFF17130F);
        context.fill(x - 1, y - 1, x + width + 1, y + 9, 0xFF4A3523);
        context.fill(x, y, x + width, y + 8, 0xFFB49A68);
        context.fill(x + 1, y + 1, x + width - 1, y + 7, 0xFF29251E);
        int progress = Math.round((width - 2) * value / 100.0F);
        context.fill(x + 1, y + 1, x + 1 + progress, y + 7, darkColor);
        if (progress > 1) {
            context.fill(x + 2, y + 2, x + 1 + progress, y + 4, lightColor);
            context.fill(x + 2, y + 5, x + 1 + progress, y + 7, 0x33000000);
        }
        // Feuillage discret gravé aux extrémités du cadre.
        context.fill(x - 3, y + 1, x - 1, y + 7, 0xFF394B25);
        context.fill(x - 1, y, x + 1, y + 3, 0xFF66763A);
        context.fill(x + width + 1, y + 1, x + width + 3, y + 7, 0xFF394B25);
        context.fill(x + width - 1, y + 5, x + width + 1, y + 8, 0xFF66763A);
        String text = label + " " + value;
        int textX = x + (width - client.textRenderer.getWidth(text)) / 2;
        context.drawTextWithShadow(client.textRenderer, text, textX, y - 1, 0xFFF2E8D2);
    }

    private void tomize$playerBar(
            DrawContext context, MinecraftClient client, int x, int y, int width,
            int value, PlayerEntity player) {
        context.fill(x - 2, y - 2, x + width + 2, y + 7, 0xAA000000);
        context.fill(x - 1, y - 1, x + width + 1, y + 6, 0xFF4A3523);
        context.fill(x, y, x + width, y + 5, 0xFFB49A68);
        context.fill(x + 1, y + 1, x + width - 1, y + 4, 0xFF29251E);
        int progress = Math.round((width - 2) * value / 100.0F);
        context.fill(x + 1, y + 1, x + 1 + progress, y + 4, 0xFF9E2925);
        if (progress > 1) context.fill(x + 2, y + 1, x + 1 + progress, y + 2, 0xFFD05A47);
        String label = player.getName().getString() + "  " + value + "%";
        int textX = x + (width - client.textRenderer.getWidth(label)) / 2;
        context.drawTextWithShadow(client.textRenderer, label, textX, y - 9, 0xFFF2E8D2);
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
