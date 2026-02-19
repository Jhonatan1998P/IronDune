
import { GameState, LogEntry } from '../../../types';

export type ActionResult = {
    success: boolean;
    newState?: GameState;
    log?: LogEntry;
    errorKey?: string;
};
