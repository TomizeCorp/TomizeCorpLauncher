package fr.tomizecorp.epsilon.mixin;

import fr.tomizecorp.epsilon.EpsilonBranding;
import net.minecraft.client.util.Icons;
import net.minecraft.client.util.Window;
import net.minecraft.resource.ResourcePack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Window.class)
public abstract class WindowMixin {
    @Inject(method = "setTitle", at = @At("HEAD"), cancellable = true)
    private void epsilon$setTitle(String ignored, CallbackInfo ci) {
        EpsilonBranding.setTitle(((Window)(Object)this).getHandle());
        ci.cancel();
    }

    @Inject(method = "setIcon", at = @At("HEAD"), cancellable = true)
    private void epsilon$setIcon(ResourcePack ignoredPack, Icons ignoredIcons, CallbackInfo ci) {
        EpsilonBranding.setIcon(((Window)(Object)this).getHandle());
        ci.cancel();
    }
}
