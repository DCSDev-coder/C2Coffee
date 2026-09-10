import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

const UnsavedChangesContext = createContext(null);

export const UnsavedChangesProvider = ({ children, onNavigate }) => {
  const [modalState, setModalState] = useState({
    isOpen: false,
    targetPage: null,
    isSaving: false,
    errorMessage: '',
  });

  const handlerRef = useRef(null);

  const registerUnsavedHandler = useCallback((handler) => {
    handlerRef.current = handler;
    return () => {
      if (handlerRef.current === handler) {
        handlerRef.current = null;
      }
    };
  }, []);

  const clearUnsavedHandler = useCallback(() => {
    handlerRef.current = null;
  }, []);

  // Listen for browser tab close/reload
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (handlerRef.current?.hasUnsavedChanges?.()) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const navigateWithPrompt = useCallback((targetPage) => {
    if (handlerRef.current?.hasUnsavedChanges?.()) {
      setModalState({
        isOpen: true,
        targetPage,
        isSaving: false,
        errorMessage: '',
      });
      return false;
    }
    onNavigate(targetPage);
    return true;
  }, [onNavigate]);

  const handleDiscardAndLeave = () => {
    const target = modalState.targetPage;
    handlerRef.current?.onDiscard?.();
    handlerRef.current = null;
    setModalState({ isOpen: false, targetPage: null, isSaving: false, errorMessage: '' });
    if (target) onNavigate(target);
  };

  const handleSaveAndLeave = async () => {
    if (!handlerRef.current?.onSave) {
      handleDiscardAndLeave();
      return;
    }
    setModalState((prev) => ({ ...prev, isSaving: true, errorMessage: '' }));
    try {
      const result = await handlerRef.current.onSave();
      if (result !== false) {
        const target = modalState.targetPage;
        handlerRef.current = null;
        setModalState({ isOpen: false, targetPage: null, isSaving: false, errorMessage: '' });
        if (target) onNavigate(target);
      } else {
        setModalState((prev) => ({
          ...prev,
          isSaving: false,
          errorMessage: 'Unable to save changes. Please review the page and try again.',
        }));
      }
    } catch (err) {
      setModalState((prev) => ({
        ...prev,
        isSaving: false,
        errorMessage: err.message || 'Unable to save changes.',
      }));
    }
  };

  const handleCancelModal = () => {
    setModalState({ isOpen: false, targetPage: null, isSaving: false, errorMessage: '' });
  };

  return (
    <UnsavedChangesContext.Provider
      value={{
        registerUnsavedHandler,
        clearUnsavedHandler,
        navigateWithPrompt,
        hasUnsavedChanges: () => handlerRef.current?.hasUnsavedChanges?.() ?? false,
      }}
    >
      {children}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl max-w-md w-full border border-gray-100 flex flex-col">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 ring-4 ring-amber-50/50">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">Unsaved Changes</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              You have unsaved changes on this page. Do you want to save before leaving?
            </p>

            {modalState.errorMessage && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {modalState.errorMessage}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 justify-end">
              <button
                type="button"
                onClick={handleCancelModal}
                disabled={modalState.isSaving}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleDiscardAndLeave}
                disabled={modalState.isSaving}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
              >
                Discard &amp; Leave
              </button>
              <button
                type="button"
                onClick={handleSaveAndLeave}
                disabled={modalState.isSaving}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[#1F3A34] hover:bg-[#2E5E58] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
              >
                {modalState.isSaving ? 'Saving...' : 'Save & Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </UnsavedChangesContext.Provider>
  );
};

export const useUnsavedChanges = () => {
  const context = useContext(UnsavedChangesContext);
  return context || {
    registerUnsavedHandler: () => () => {},
    clearUnsavedHandler: () => {},
    navigateWithPrompt: (page) => true,
    hasUnsavedChanges: () => false,
  };
};
