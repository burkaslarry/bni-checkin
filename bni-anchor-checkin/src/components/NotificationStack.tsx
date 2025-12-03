import { NotificationEntry } from "./ScanPanel";

type NotificationStackProps = {
  notifications: NotificationEntry[];
};

export const NotificationStack = ({ notifications }: NotificationStackProps) => {
  return (
    <div className="toast-stack" aria-live="polite">
      {notifications.map((note) => (
        <div key={note.id} className={`toast ${note.type}`}>
          {note.message}
        </div>
      ))}
    </div>
  );
};

