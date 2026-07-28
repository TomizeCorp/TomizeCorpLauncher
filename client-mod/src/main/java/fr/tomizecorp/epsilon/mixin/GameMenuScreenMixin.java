package fr.tomizecorp.epsilon.mixin;

import fr.tomizecorp.epsilon.EpsilonBranding;
import java.net.URI;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.GameMenuScreen;
import net.minecraft.client.gui.screen.TitleScreen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;
import net.minecraft.util.Util;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.Redirect;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(GameMenuScreen.class)
public abstract class GameMenuScreenMixin {
    @Redirect(
        method = "addFeedbackAndBugsButtons",
        at = @At(
            value = "INVOKE",
            target = "Lnet/minecraft/client/gui/screen/GameMenuScreen;createUrlButton(Lnet/minecraft/client/gui/screen/Screen;Lnet/minecraft/text/Text;Ljava/net/URI;)Lnet/minecraft/client/gui/widget/ButtonWidget;"
        ),
        require = 0
    )
    private static ButtonWidget tomize$replaceMinecraftLinks(Screen parent, Text text, URI uri) {
        return ButtonWidget.builder(Text.translatable("menu.epsilon.review"), button ->
            Util.getOperatingSystem().open(URI.create(EpsilonBranding.REVIEWS_URL))
        ).build();
    }

    @Inject(method = "method_72129", at = @At("TAIL"))
    private void tomize$returnHomeAfterDisconnect(CallbackInfo ci) {
        MinecraftClient.getInstance().setScreen(new TitleScreen());
    }
}
