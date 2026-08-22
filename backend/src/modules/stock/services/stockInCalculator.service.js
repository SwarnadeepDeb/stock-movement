class stockInCalculator {
    calculateStockIn(activeSizes, input) {
        const delta = new Map(activeSizes.map((size) => [size.id, 0]));

        // complete set
        this._addCompleteSets(delta, activeSizes, input.totalSetsReceived ?? 0);

        // bundle
        this._addBundles(delta, input.bundles ?? []);

        // loose pieces
        this._addLoosePieces(delta, input.loosePieces ?? []);

        return delta
    }

    _addCompleteSets(delta, activeSizes, quantity) {
        if (quantity <= 0) return;

        for (const size of activeSizes) {
            if (!size.includedInSet) continue;

            delta.set(size.id, delta.get(size.id) + quantity);
        }
    }

    _addBundles(delta, bundles) {
        for (const bundle of bundles) {
            for (const piece of bundle.composition) {
                const quantity = piece.quantity * bundle.quantity;

                delta.set(piece.designSizeId, delta.get(piece.designSizeId) + quantity);
            }
        }
    }

    _addLoosePieces(delta, loosePieces) {
        for (const piece of loosePieces) {
            delta.set(piece.designSizeId, delta.get(piece.designSizeId) + piece.quantity);
        }
    }
}

export default new stockInCalculator();
