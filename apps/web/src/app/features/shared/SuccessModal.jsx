import {
  RealtimeUpgradeModal as LegacyRealtimeUpgradeModal,
  SuccessModal as LegacySuccessModal,
} from "../../../../../../bcms-saas-platform.jsx";

export function SuccessModal(props) {
  return <LegacySuccessModal {...props} />;
}

export function RealtimeUpgradeModal(props) {
  return <LegacyRealtimeUpgradeModal {...props} />;
}
