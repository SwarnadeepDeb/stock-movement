import { configureStore } from "@reduxjs/toolkit";
import sidebarReducer from "./slice/sidebarSlice";

export const store = configureStore({
    reducer: {
        sidebar: sidebarReducer,
    },
});
