package fr.tomizecorp.epsilon.mixin;

import fr.tomizecorp.epsilon.EpsilonBranding;
import java.net.URI;
import java.util.List;
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
public abstract class GameMenuScreenMixin extends Screen {
    protected GameMenuScreenMixin(Text title) {
        super(title);
    }

    @Inject(method = "init", at = @At("TAIL"))
    private void tomize$centerPauseMenu(CallbackInfo ci) {
        List<ButtonWidget> buttons = children().stream()
            .filter(ButtonWidget.class::isInstance)
            .map(ButtonWidget.class::cast)
            .toList();
        int buttonWidth = 200;
        int left = (width - buttonWidth) / 2;
        int top = height / 4 + 18;
        for (int index = 0; index < buttons.size(); index++) {
            ButtonWidget button = buttons.get(index);
            button.setX(left);
            button.setY(top + index * 24);
            button.setWidth(buttonWidth);
        }
    }

    @Redirect(
        method = "addFeedbackAndBugsButtons",
        at = @At(
            value = "INVOKE",
            target = "Lnet/minecraft/client/gui/screen/GameMenuScreen;createUrlButton(Lnet/minecraft/client/gui/screen/Screen;Lnet/minecraft/text/Text;Ljava/net/URI;)Lnet/minecraft/client/gui/widget/ButtonWidget;"
        ),
        require = 0
    )
    private static ButtonWidget tomize$replaceMinecraftLinks(Screen parent, Text text, URI uri) {
        boolean feedbackLink = uri != null && uri.toString().toLowerCase().contains("feedback");
        URI destination = feedbackLink ? URI.create(EpsilonBranding.REVIEWS_URL) : uri;
        Text label = feedbackLink ? Text.translatable("menu.epsilon.review") : text;
        return ButtonWidget.builder(label, button ->
            Util.getOperatingSystem().open(destination)
        ).build();
    }

    @Inject(method = "method_72129", at = @At("TAIL"))
    private void tomize$returnHomeAfterDisconnect(CallbackInfo ci) {
        MinecraftClient.getInstance().setScreen(new TitleScreen());
    }
}
