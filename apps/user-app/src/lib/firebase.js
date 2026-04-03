import { createFirebaseClients } from "../../../../shared/firebase/firebaseClient";

const clients = createFirebaseClients();

export const { app, auth, db, storage, secondaryAuth } = clients;
