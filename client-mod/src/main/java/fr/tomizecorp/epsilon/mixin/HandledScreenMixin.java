package fr.tomizecorp.epsilon.mixin;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.ingame.CreativeInventoryScreen;
import net.minecraft.client.gui.screen.ingame.HandledScreen;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(HandledScreen.class)
public abstract class HandledScreenMixin extends Screen {
    @Shadow protected int titleX;
    @Shadow protected int titleY;
    @Shadow protected int x;
    @Shadow protected int y;
    protected HandledScreenMixin(Text title) {
        super(title);
    }

    @Inject(method = "render", at = @At("TAIL"))
    private void tomize$redrawReadableLabels(DrawContext context, int mouseX, int mouseY, float delta, CallbackInfo ci) {
        if ((Object) this instanceof CreativeInventoryScreen) return;
        // Certains écrans, notamment le livre de recettes, conservent une zone de découpe
        // jusqu'à la fin du rendu. Le titre doit toujours être dessiné au-dessus de celle-ci.
        context.disableScissor();
        int titleLeft = x + titleX;
        int titleTop = y + titleY;
        drawLabelFrame(context, title, titleLeft, titleTop);
        context.drawText(MinecraftClient.getInstance().textRenderer, title, titleLeft, titleTop, 0xFFFFFFFF, true);
    }

    private static void drawLabelFrame(DrawContext context, Text text, int x, int y) {
        if (text == null || text.getString().isBlank()) return;
        int width = MinecraftClient.getInstance().textRenderer.getWidth(text);
        context.fill(x - 4, y - 3, x + width + 4, y + 12, 0xFF17130D);
        context.fill(x - 3, y - 2, x + width + 3, y + 11, 0xFFE0C279);
        context.fill(x - 2, y - 1, x + width + 2, y + 10, 0xE0202A1C);
    }
}
