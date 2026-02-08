import { createContext } from 'react';
import { ConfirmationContextType } from './confirmation-types';

export const ConfirmationContext = createContext<ConfirmationContextType | undefined>(undefined);
