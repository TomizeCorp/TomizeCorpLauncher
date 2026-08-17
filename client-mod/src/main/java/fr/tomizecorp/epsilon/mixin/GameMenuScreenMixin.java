package fr.tomizecorp.epsilon.mixin;

import fr.tomizecorp.epsilon.EpsilonBranding;
import java.net.URI;
import java.util.List;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
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
        int fullWidth = 200;
        int halfWidth = 98;
        int left = (width - fullWidth) / 2;
        int top = height / 4 + 18;
        for (int index = 0; index < buttons.size(); index++) {
            ButtonWidget button = buttons.get(index);
            boolean fullRow = index == 0 || index == buttons.size() - 1;
            if (fullRow) {
                button.setX(left);
                button.setY(top + (index == 0 ? 0 : ((index + 1) / 2) * 24));
                button.setWidth(fullWidth);
            } else {
                int middleIndex = index - 1;
                button.setX(left + (middleIndex % 2) * (halfWidth + 4));
                button.setY(top + (middleIndex / 2 + 1) * 24);
                button.setWidth(halfWidth);
            }
        }
    }

    @Inject(
        method = "render",
        at = @At(
            value = "INVOKE",
            target = "Lnet/minecraft/client/gui/screen/Screen;render(Lnet/minecraft/client/gui/DrawContext;IIF)V",
            shift = At.Shift.BEFORE
        ),
        require = 0
    )
    private void tomize$renderBlueMenuPanel(DrawContext context, int mouseX, int mouseY, float deltaTicks, CallbackInfo ci) {
        int minX = Integer.MAX_VALUE;
        int minY = Integer.MAX_VALUE;
        int maxX = Integer.MIN_VALUE;
        int maxY = Integer.MIN_VALUE;
        for (ButtonWidget button : children().stream().filter(ButtonWidget.class::isInstance).map(ButtonWidget.class::cast).toList()) {
            minX = Math.min(minX, button.getX());
            minY = Math.min(minY, button.getY());
            maxX = Math.max(maxX, button.getX() + button.getWidth());
            maxY = Math.max(maxY, button.getY() + button.getHeight());
        }
        if (minX == Integer.MAX_VALUE) return;
        int left = minX - 12;
        int top = minY - 12;
        int right = maxX + 12;
        int bottom = maxY + 12;
        context.fill(left - 2, top - 2, right + 2, bottom + 2, 0xE5121D4E);
        context.fill(left, top, right, bottom, 0xE51B2A70);
        context.fill(left + 2, top + 2, right - 2, bottom - 2, 0xE5435EE8);
        context.fill(left + 4, top + 4, right - 4, bottom - 4, 0xF0121D4E);
        context.fill(left + 4, top + 4, right - 4, top + 6, 0xFFAEBAF7);
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
