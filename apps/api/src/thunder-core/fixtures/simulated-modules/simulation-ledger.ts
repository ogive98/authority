export interface SimulatedReservation {
  orderId: string;
  sku: string;
  qty: number;
  correlationId: string;
}

export interface SimulatedNotification {
  orderId: string;
  channel: string;
  correlationId: string;
}

export const simulationLedger = {
  reservations: [] as SimulatedReservation[],
  notifications: [] as SimulatedNotification[],
};

export function resetSimulationLedger(): void {
  simulationLedger.reservations.length = 0;
  simulationLedger.notifications.length = 0;
}
