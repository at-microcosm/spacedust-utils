export function NotificationSettings({ secondary, secondaryFilter }) {
  if (secondary === 'all') {
    return <p>Notifications default: [todo: toggle mute], unknown sources: [toggle mute]</p>;
  }
  if (secondaryFilter === null) {
    return null;
  }
  return (
    <p>{secondaryFilter} [todo: toggle mute]</p>
  );
}
