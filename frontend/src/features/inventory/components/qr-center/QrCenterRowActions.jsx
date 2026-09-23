import { EyeIcon } from "lucide-react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";

// Navigates to the dedicated QR Grid page for this registration — a "row -> detail page,
// not a modal" pattern (see App.jsx routes). Stock In and Transformation registrations
// resolve to different route shapes (see App.jsx).
const QrCenterRowActions = ({ registrationType, registrationId }) => {
  const navigate = useNavigate();

  const path = registrationType === "TRANSFORMATION"
    ? `/qr-center/transformation/${registrationId}`
    : `/qr-center/${registrationId}`;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="View QR codes"
      title="View QR codes"
      onClick={() => navigate(path)}
    >
      <EyeIcon />
    </Button>
  );
};

export default QrCenterRowActions;
