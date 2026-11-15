import * as WebBrowser from 'expo-web-browser';

type MidtransCheckout = {
  paymentUrl: string;
};

export async function openMidtransSnap({ paymentUrl }: MidtransCheckout) {
  if (!paymentUrl) {
    throw new Error('URL pembayaran Midtrans tidak tersedia.');
  }

  return WebBrowser.openBrowserAsync(paymentUrl);
}
