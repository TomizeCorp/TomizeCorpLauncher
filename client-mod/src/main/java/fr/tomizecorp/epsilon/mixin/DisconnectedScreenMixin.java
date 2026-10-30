package fr.tomizecorp.epsilon.mixin;

import net.minecraft.client.gui.screen.DisconnectedScreen;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.TitleScreen;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Mutable;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(DisconnectedScreen.class)
public abstract class DisconnectedScreenMixin {
    @Shadow @Final @Mutable private Screen parent;
    @Shadow @Final @Mutable private Text buttonLabel;

    @Inject(method = "init", at = @At("HEAD"))
    private void epsilon$returnToMenu(CallbackInfo ci) {
        parent = new TitleScreen();
        buttonLabel = Text.literal("Retourner au menu");
    }
}
