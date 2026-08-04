import { firebaseConfig } from "./firebase-config.js";

const FIREBASE_VERSION = "12.16.0";
const configured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "REPLACE_ME";
let servicesPromise;

export function isFirebaseConfigured() {
  return Boolean(configured);
}

export function getFirebaseServices() {
  if (!configured) return Promise.resolve(null);
  if (!servicesPromise) {
    servicesPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
    ]).then(([appSdk, authSdk, firestoreSdk]) => {
      const app = appSdk.initializeApp(firebaseConfig);
      return {
        app,
        auth: authSdk.getAuth(app),
        db: firestoreSdk.getFirestore(app),
        authSdk,
        firestoreSdk
      };
    });
  }
  return servicesPromise;
}
