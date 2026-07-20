package fr.tomizecorp.epsilon.mixin;

import fr.tomizecorp.epsilon.EpsilonSkin;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.entity.player.SkinTextures;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(PlayerListEntry.class)
public abstract class PlayerListEntryMixin {
    @Inject(method = "getSkinTextures", at = @At("HEAD"), cancellable = true)
    private void epsilon$localSkin(CallbackInfoReturnable<SkinTextures> cir) {
        PlayerListEntry entry = (PlayerListEntry)(Object)this;
        SkinTextures skin = EpsilonSkin.get(entry.getProfile().name());
        if (skin != null) cir.setReturnValue(skin);
    }
}
