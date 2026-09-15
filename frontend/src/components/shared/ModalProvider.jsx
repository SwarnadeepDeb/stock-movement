"use client";

import { createContext, useState, useContext } from "react";

const ModalContext = createContext(null);

export const ModalProvider = ({ children }) => {
    const [modal, setModal] = useState(null);

    const openModal = (Component, props) => { setModal({ Component, props }) }

    const closeModal = () => setModal(null);

    return (
        <ModalContext.Provider value={{ openModal, closeModal }}>
            {children}
            {modal && (<modal.Component {...modal.props} onClose={closeModal} />)}
        </ModalContext.Provider>
    )
}

export const useModal = () => {
    const context = useContext(ModalContext);

    if (!context) {
        throw new Error("useModal must be used within a ModalProvider");
    }

    return context;
};
