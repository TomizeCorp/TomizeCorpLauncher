package fr.tomizecorp.epsilon.mixin;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.ingame.InventoryScreen;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(InventoryScreen.class)
public abstract class InventoryScreenMixin {
    @Shadow protected int titleX;
    @Shadow protected int titleY;
    @Shadow protected Text title;

    @Inject(method = "drawForeground", at = @At("HEAD"), cancellable = true)
    private void tomize$drawCraftingTitle(DrawContext context, int mouseX, int mouseY, CallbackInfo ci) {
        int width = MinecraftClient.getInstance().textRenderer.getWidth(title);
        context.fill(titleX - 4, titleY - 3, titleX + width + 4, titleY + 12, 0xFF17130D);
        context.fill(titleX - 3, titleY - 2, titleX + width + 3, titleY + 11, 0xFFE0C279);
        context.fill(titleX - 2, titleY - 1, titleX + width + 2, titleY + 10, 0xE0202A1C);
        context.drawText(MinecraftClient.getInstance().textRenderer, title, titleX, titleY, 0xFFFFFFFF, true);
        ci.cancel();
    }
}
