import { StyleSheet, Text, View } from 'react-native';

import { CRM, cardStyles } from '@/components/crm-ui';

export type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  submittedAt: string | null;
  receivedAt: string;
  status: string;
};

export function LeadCard({ lead }: { lead: Lead }) {
  const timestamp = lead.submittedAt ?? lead.receivedAt;
  return (
    <View style={[cardStyles.card, styles.card]}>
      <View style={styles.topRow}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(lead.name?.trim().charAt(0) || 'L').toUpperCase()}
            </Text>
          </View>
          <View style={styles.nameBlock}>
            <Text numberOfLines={1} style={styles.name}>
              {lead.name || 'New lead'}
            </Text>
            {lead.email ? (
              <Text numberOfLines={1} style={styles.detail}>
                {lead.email}
              </Text>
            ) : null}
          </View>
        </View>
        <Text style={styles.status}>{lead.status}</Text>
      </View>
      {lead.phone ? <Text style={styles.detail}>Phone: {lead.phone}</Text> : null}
      <Text style={styles.timestamp}>
        {timestamp ? `Submitted ${new Date(timestamp).toLocaleString()}` : 'Submission time unavailable'}
      </Text>
      <Text numberOfLines={1} style={styles.id}>
        ID: {lead.id}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 11 },
  topRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  identity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 11 },
  avatar: {
    alignItems: 'center',
    backgroundColor: CRM.paleBlue,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  avatarText: { color: CRM.primary, fontSize: 16, fontWeight: '800' },
  nameBlock: { flex: 1, gap: 3 },
  name: { color: CRM.text, fontSize: 15, fontWeight: '700' },
  detail: { color: CRM.secondary, fontSize: 13 },
  status: {
    backgroundColor: CRM.paleGreen,
    borderRadius: 99,
    color: CRM.green,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
    textTransform: 'capitalize',
  },
  timestamp: { color: CRM.secondary, fontSize: 12 },
  id: { color: '#8791a2', fontSize: 11 },
});
