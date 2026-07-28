package fr.tomizecorp.epsilon.mixin;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
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

    protected HandledScreenMixin(Text title) {
        super(title);
    }

    @Inject(method = "drawForeground", at = @At("HEAD"), cancellable = true)
    private void tomize$drawSingleReadableTitle(DrawContext context, int mouseX, int mouseY, CallbackInfo ci) {
        drawLabelFrame(context, title, titleX, titleY);
        context.drawText(MinecraftClient.getInstance().textRenderer, title, titleX, titleY, 0xFFFFFFFF, true);
        ci.cancel();
    }

    private static void drawLabelFrame(DrawContext context, Text text, int x, int y) {
        if (text == null || text.getString().isBlank()) return;
        int width = MinecraftClient.getInstance().textRenderer.getWidth(text);
        context.fill(x - 4, y - 3, x + width + 4, y + 12, 0xFF17130D);
        context.fill(x - 3, y - 2, x + width + 3, y + 11, 0xFFE0C279);
        context.fill(x - 2, y - 1, x + width + 2, y + 10, 0xE0202A1C);
    }
}
