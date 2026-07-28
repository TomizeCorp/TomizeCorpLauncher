package fr.tomizecorp.epsilon.mixin;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.ingame.CreativeInventoryScreen;
import net.minecraft.item.ItemGroup;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(CreativeInventoryScreen.class)
public abstract class CreativeInventoryScreenMixin {
    @Shadow private static ItemGroup selectedTab;

    @Inject(method = "drawForeground", at = @At("TAIL"))
    private void tomize$drawSelectedCategory(DrawContext context, int mouseX, int mouseY, CallbackInfo ci) {
        if (selectedTab == null || !selectedTab.shouldRenderName()) return;
        Text category = selectedTab.getDisplayName();
        int left = 8;
        int top = 6;
        int width = MinecraftClient.getInstance().textRenderer.getWidth(category);
        context.fill(left - 4, top - 3, left + width + 4, top + 12, 0xFF17130D);
        context.fill(left - 3, top - 2, left + width + 3, top + 11, 0xFFE0C279);
        context.fill(left - 2, top - 1, left + width + 2, top + 10, 0xE0202A1C);
        context.drawText(MinecraftClient.getInstance().textRenderer, category, left, top, 0xFFFFFFFF, true);
    }
}
