import { Alert as RNAlert, AlertButton, Platform } from 'react-native';

/**
 * Alert.alert de React Native no hace nada en la versión web.
 * Este reemplazo usa los diálogos del navegador en web y el nativo en el celular.
 */
function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    RNAlert.alert(title, message, buttons);
    return;
  }
  const text = [title, message].filter(Boolean).join('\n\n');
  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }
  const cancel = buttons.find((b) => b.style === 'cancel');
  const action = buttons.find((b) => b !== cancel);
  if (window.confirm(text)) action?.onPress?.();
  else cancel?.onPress?.();
}

export const Alert = { alert };
