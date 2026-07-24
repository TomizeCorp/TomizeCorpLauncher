package fr.tomizecorp.epsilon.mixin;

import fr.tomizecorp.epsilon.TomizeKeyBindings;
import java.util.Arrays;
import net.minecraft.client.option.GameOptions;
import net.minecraft.client.option.KeyBinding;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Mutable;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(GameOptions.class)
public abstract class GameOptionsMixin {
    @Shadow @Final @Mutable public KeyBinding[] allKeys;

    @Inject(method = "<init>", at = @At(value = "INVOKE",
            target = "Lnet/minecraft/client/option/GameOptions;load()V"))
    private void tomize$registerConfigurableKeys(CallbackInfo ci) {
        int length = allKeys.length;
        allKeys = Arrays.copyOf(allKeys, length + 1);
        allKeys[length] = TomizeKeyBindings.WAYPOINTS;
        KeyBinding.updateKeysByCode();
    }
}
