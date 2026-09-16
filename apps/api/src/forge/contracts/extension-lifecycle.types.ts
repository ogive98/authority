import type { FrgExtensionStatus } from '@prisma/client';

export type ExtensionLifecycleTransition = {
  from: FrgExtensionStatus;
  to: FrgExtensionStatus;
};
