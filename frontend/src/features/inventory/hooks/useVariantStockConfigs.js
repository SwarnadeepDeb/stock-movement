import { useCallback, useState } from "react";
import { getVariantKey } from "../utils/variantKey";
import { createLocalId } from "../utils/localId";

const createDefaultConfig = ({ designId, colorVariantId }) => ({
  designId,
  colorVariantId,
  totalSetsReceived: 0,
  bundles: [],
  loosePieces: {},
});

// Maps each selected variant (by its UI-only key) to its own, independent stock-entry
// draft, so switching the active variant never touches another variant's state.
export function useVariantStockConfigs() {
  const [configs, setConfigs] = useState({});

  const ensureConfig = useCallback((variant) => {
    const key = getVariantKey(variant);
    setConfigs((prev) => (prev[key] ? prev : { ...prev, [key]: createDefaultConfig(variant) }));
  }, []);

  const setTotalSetsReceived = useCallback((variantKey, totalSetsReceived) => {
    setConfigs((prev) => ({
      ...prev,
      [variantKey]: { ...prev[variantKey], totalSetsReceived },
    }));
  }, []);

  const addBundle = useCallback((variantKey, { quantity, composition, label }) => {
    setConfigs((prev) => ({
      ...prev,
      [variantKey]: {
        ...prev[variantKey],
        bundles: [
          ...prev[variantKey].bundles,
          { localId: createLocalId(), quantity, composition, label },
        ],
      },
    }));
  }, []);

  const updateBundle = useCallback((variantKey, localId, { quantity, composition }) => {
    setConfigs((prev) => ({
      ...prev,
      [variantKey]: {
        ...prev[variantKey],
        bundles: prev[variantKey].bundles.map((bundle) =>
          bundle.localId === localId ? { ...bundle, quantity, composition } : bundle
        ),
      },
    }));
  }, []);

  const removeBundle = useCallback((variantKey, localId) => {
    setConfigs((prev) => ({
      ...prev,
      [variantKey]: {
        ...prev[variantKey],
        bundles: prev[variantKey].bundles.filter((bundle) => bundle.localId !== localId),
      },
    }));
  }, []);

  const setLoosePieces = useCallback((variantKey, loosePieces) => {
    setConfigs((prev) => ({
      ...prev,
      [variantKey]: { ...prev[variantKey], loosePieces },
    }));
  }, []);

  const reset = useCallback(() => setConfigs({}), []);

  // Replaces every config at once — used when resuming a saved Stock In draft.
  const hydrate = useCallback((nextConfigs) => setConfigs(nextConfigs ?? {}), []);

  return {
    configs,
    ensureConfig,
    setTotalSetsReceived,
    addBundle,
    updateBundle,
    removeBundle,
    setLoosePieces,
    reset,
    hydrate,
  };
}
