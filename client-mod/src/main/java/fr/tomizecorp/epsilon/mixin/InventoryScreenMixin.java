package fr.tomizecorp.epsilon.mixin;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.ingame.InventoryScreen;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(InventoryScreen.class)
public abstract class InventoryScreenMixin extends Screen {
    private static final int TITLE_X = 97;
    private static final int TITLE_Y = 6;

    protected InventoryScreenMixin(Text title) {
        super(title);
    }

    @Inject(method = "drawForeground", at = @At("HEAD"), cancellable = true)
    private void tomize$drawCraftingTitle(DrawContext context, int mouseX, int mouseY, CallbackInfo ci) {
        int width = MinecraftClient.getInstance().textRenderer.getWidth(title);
        context.fill(TITLE_X - 4, TITLE_Y - 3, TITLE_X + width + 4, TITLE_Y + 12, 0xFF17130D);
        context.fill(TITLE_X - 3, TITLE_Y - 2, TITLE_X + width + 3, TITLE_Y + 11, 0xFFE0C279);
        context.fill(TITLE_X - 2, TITLE_Y - 1, TITLE_X + width + 2, TITLE_Y + 10, 0xE0202A1C);
        context.drawText(MinecraftClient.getInstance().textRenderer, title, TITLE_X, TITLE_Y, 0xFFFFFFFF, true);
        ci.cancel();
    }
}
