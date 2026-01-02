
import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('NEW_PUBLIC_KEY=' + vapidKeys.publicKey);
console.log('NEW_PRIVATE_KEY=' + vapidKeys.privateKey);
