export const btcAddrWallet1 = {
  version: "0x01",
  hashbytes: "0x000102030405060708090a0b0c0d0e0f00010203",
};

export const btcAddrWallet2 = {
  version: "0x01",
  hashbytes: "0x00102030405060708090a0b0c0d0e0f000102030",
};

export const poxAddrPool1 = {
  version: "0x01",
  hashbytes: "0xb0b75f408a29c271d107e05d614d0ff439813d02",
};

export const poxAddrPool2 = {
  version: "0x01",
  hashbytes: "0x00b0b75f408a29c271d107e05d614d0ff439813d",
};

// as defined in pox-pool-self-service.clar
export const poxAddrFP = {
  version: "0x04",
  hashbytes: "0x83ed66860315e334010bbfb76eb3eef887efee0a",
};

export const Errors = {
  NotFound: 404,
  NonPositiveAmount: 500,
  NoStackerInfo: 501,
  NoUserInfo: 502,
  StackingPermissionDenied: 609,
};

export const PoxErrors = {
  StackingAlreadyStacked: 3,
  StackingPermissionDenied: 9,
  StackingThresholdNotMet: 11,
  DelegationTooMuchLocked: 22,
  InvalidStartBurnHeight: 24,
  StackExtendNotLocked: 26,
};

export const FpErrors = {
  Unauthorized: 401,
  Forbidden: 403,
  TooEarly: 500,
  PoxAddressDeactivated: 504,
  AlreadyStacking: 603,
  StackingPermissionDenied: 609,
};
