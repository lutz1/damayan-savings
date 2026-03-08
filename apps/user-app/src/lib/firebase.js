import { createFirebaseClients } from "../../../../shared/firebase/firebaseClient";

const clients = createFirebaseClients("UserApp");

export const { app, auth, db, storage, secondaryAuth } = clients;
