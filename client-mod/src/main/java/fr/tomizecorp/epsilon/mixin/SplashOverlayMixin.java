package fr.tomizecorp.epsilon.mixin;

import net.minecraft.client.gl.RenderPipelines;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.SplashOverlay;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(SplashOverlay.class)
public abstract class SplashOverlayMixin {
    private static final Identifier EPSILON_LOADING = Identifier.of("epsilon", "textures/gui/loading.png");
    private static final int IMAGE_WIDTH = 1920;
    private static final int IMAGE_HEIGHT = 1080;

    @Shadow private float progress;

    @Inject(method = "render", at = @At("TAIL"))
    private void epsilon$renderLoadingScreen(DrawContext context, int mouseX, int mouseY, float deltaTicks, CallbackInfo ci) {
        int width = context.getScaledWindowWidth();
        int height = context.getScaledWindowHeight();
        context.fill(0, 0, width, height, 0xFF000000);

        float scale = Math.min((float) width / IMAGE_WIDTH, (float) height / IMAGE_HEIGHT);
        int imageWidth = Math.max(1, Math.round(IMAGE_WIDTH * scale));
        int imageHeight = Math.max(1, Math.round(IMAGE_HEIGHT * scale));
        int imageX = (width - imageWidth) / 2;
        int imageY = (height - imageHeight) / 2;
        context.drawTexture(RenderPipelines.GUI_TEXTURED, EPSILON_LOADING, imageX, imageY, 0, 0,
                imageWidth, imageHeight, IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_WIDTH, IMAGE_HEIGHT);

        int barWidth = Math.min(520, Math.max(180, width / 2));
        int barHeight = Math.max(6, height / 90);
        int barX = (width - barWidth) / 2;
        int barY = Math.min(height - 24, imageY + Math.round(imageHeight * 0.84F));
        float visibleProgress = Math.max(0.0F, Math.min(1.0F, this.progress));
        context.fill(barX - 2, barY - 2, barX + barWidth + 2, barY + barHeight + 2, 0xFFFFFFFF);
        context.fill(barX, barY, barX + barWidth, barY + barHeight, 0xFF080808);
        context.fill(barX, barY, barX + Math.round(barWidth * visibleProgress), barY + barHeight, 0xFFFFBD12);
    }
}
