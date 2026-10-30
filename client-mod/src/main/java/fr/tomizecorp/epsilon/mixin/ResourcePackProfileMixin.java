package fr.tomizecorp.epsilon.mixin;

import net.minecraft.resource.ResourcePackProfile;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(ResourcePackProfile.class)
public abstract class ResourcePackProfileMixin {
    @Shadow public abstract String getId();

    @Inject(method = {"isRequired", "isPinned"}, at = @At("HEAD"), cancellable = true)
    private void epsilon$requireUiPack(CallbackInfoReturnable<Boolean> cir) {
        if ("file/TomizeCorpUI".equals(getId())) cir.setReturnValue(true);
    }
}
