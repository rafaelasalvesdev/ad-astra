// js/storage.js

const Storage = {
    async getPrompts() {
        return await window.astraAPI.getPrompts();
    },

    async savePrompts(promptsArray) {
        return await window.astraAPI.savePrompts(promptsArray);
    },

    async getMetadata() {
        return await window.astraAPI.getMetadata();
    },

    async saveMetadata(metaObj) {
        return await window.astraAPI.saveMetadata(metaObj);
    }
};