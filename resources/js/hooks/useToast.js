import { useEffect, useReducer, useRef } from 'react';

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 4000;

let count = 0;
function genId() {
    count = (count + 1) % Number.MAX_VALUE;
    return count.toString();
}

const toastTimeouts = new Map();

const addToRemoveQueue = (toastId, dispatch) => {
    if (toastTimeouts.has(toastId)) return;
    const timeout = setTimeout(() => {
        toastTimeouts.delete(toastId);
        dispatch({ type: 'REMOVE_TOAST', toastId });
    }, TOAST_REMOVE_DELAY);
    toastTimeouts.set(toastId, timeout);
};

function reducer(state, action) {
    switch (action.type) {
        case 'ADD_TOAST':
            return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) };
        case 'DISMISS_TOAST': {
            const { toastId } = action;
            return {
                ...state,
                toasts: state.toasts.map((t) => t.id === toastId || toastId === undefined ? { ...t, open: false } : t),
            };
        }
        case 'REMOVE_TOAST':
            return { ...state, toasts: state.toasts.filter((t) => t.id !== action.toastId) };
        default:
            return state;
    }
}

const listeners = [];
let memoryState = { toasts: [] };

function dispatch(action) {
    memoryState = reducer(memoryState, action);
    listeners.forEach((listener) => listener(memoryState));
}

export function toast({ title, description, variant = 'default', duration = TOAST_REMOVE_DELAY }) {
    const id = genId();
    dispatch({
        type: 'ADD_TOAST',
        toast: { id, title, description, variant, open: true },
    });
    setTimeout(() => dispatch({ type: 'DISMISS_TOAST', toastId: id }), duration);
    setTimeout(() => dispatch({ type: 'REMOVE_TOAST', toastId: id }), duration + 300);
    return id;
}

export function useToast() {
    const [state, setState] = useReducer(reducer, memoryState);

    useEffect(() => {
        listeners.push(setState);
        return () => {
            const index = listeners.indexOf(setState);
            if (index > -1) listeners.splice(index, 1);
        };
    }, []);

    return { toasts: state.toasts, toast, dismiss: (id) => dispatch({ type: 'DISMISS_TOAST', toastId: id }) };
}
