import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ScreenContainer from '../../components/ScreenContainer';
import Card from '../../components/Card';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  archiveAnnouncement,
  completeMaintenanceAnnouncement,
  fetchAnnouncements,
} from '../../api/announcements';

const TYPE_META = {
  General: { icon: 'information-circle-outline', colorKey: 'primary' },
  Maintenance: { icon: 'construct-outline', colorKey: 'warning' },
  Event: { icon: 'calendar-outline', colorKey: 'danger' },
};

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AnnouncementsScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionId, setActionId] = useState(null);
  const isAdmin = ['Admin', 'Staff'].includes(user?.role);

  const loadAnnouncements = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await fetchAnnouncements({
        limit: 50,
        includeArchived: isAdmin,
      });
      setItems(
        data.map((item) => ({
          id: item._id,
          title: item.title,
          message: item.message,
          type: item.type,
          status: item.status || 'Active',
          audienceType: item.audience_type || 'All Residents',
          date: formatDate(item.created_at),
        })),
      );
    } catch (err) {
      if (err.sessionExpired) return;
      setError(err.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  const runAction = async (item, action) => {
    setActionId(item.id);
    try {
      const response =
        action === 'complete'
          ? await completeMaintenanceAnnouncement(item.id)
          : await archiveAnnouncement(item.id);
      const count = Number(response.delivery?.recipientCount || 0);
      Alert.alert(
        action === 'complete' ? 'Maintenance completed' : 'Announcement archived',
        count
          ? `${count} affected resident${count === 1 ? '' : 's'} received a notification.`
          : 'The announcement lifecycle was updated.',
      );
      await loadAnnouncements(true);
    } catch (err) {
      if (!err.sessionExpired) {
        Alert.alert('Unable to update', err.message || 'Please try again.');
      }
    } finally {
      setActionId(null);
    }
  };

  const confirmAction = (item, action) => {
    const completing = action === 'complete';
    Alert.alert(
      completing ? 'Complete maintenance?' : 'Archive announcement?',
      completing
        ? 'Residents affected by this maintenance will be notified and the notice will stop appearing in their active list.'
        : 'This removes the notice from resident lists while retaining its audit history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: completing ? 'Complete' : 'Archive',
          style: completing ? 'default' : 'destructive',
          onPress: () => runAction(item, action),
        },
      ],
    );
  };

  useFocusEffect(
    useCallback(() => {
      loadAnnouncements();
    }, [loadAnnouncements]),
  );

  const renderItem = ({ item }) => {
    const meta = TYPE_META[item.type] || TYPE_META.General;
    const accentColor = theme[meta.colorKey];

    return (
      <Card>
        <View style={styles.cardTop}>
          <View style={[styles.iconWrap, { backgroundColor: accentColor + '18' }]}>
            <Ionicons name={meta.icon} size={20} color={accentColor} />
          </View>
          <View style={styles.cardMeta}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
            <Text style={[styles.date, { color: theme.subtext }]}>{item.date}</Text>
          </View>
          <View style={[styles.typeBadge, { backgroundColor: accentColor + '18' }]}>
            <Text style={[styles.typeText, { color: accentColor }]}>{item.type}</Text>
          </View>
        </View>
        <Text style={[styles.cardText, { color: theme.subtext }]}>{item.message}</Text>
        {isAdmin ? (
          <View style={styles.adminMeta}>
            <Text style={[styles.lifecycleText, { color: theme.subtext }]}>
              {item.status} · {item.audienceType}
            </Text>
            <View style={styles.actionRow}>
              {item.type === 'Maintenance' && item.status === 'Active' ? (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: theme.successBg }]}
                  onPress={() => confirmAction(item, 'complete')}
                  disabled={actionId === item.id}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={theme.success} />
                  <Text style={[styles.actionText, { color: theme.success }]}>Complete</Text>
                </TouchableOpacity>
              ) : null}
              {item.status !== 'Archived' ? (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: theme.dangerBg }]}
                  onPress={() => confirmAction(item, 'archive')}
                  disabled={actionId === item.id}>
                  {actionId === item.id ? (
                    <ActivityIndicator size="small" color={theme.danger} />
                  ) : (
                    <Ionicons name="archive-outline" size={16} color={theme.danger} />
                  )}
                  <Text style={[styles.actionText, { color: theme.danger }]}>Archive</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <ScreenContainer navigation={navigation}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadAnnouncements(true)}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.heading, { color: theme.text }]}>Announcements</Text>
            <Text style={[styles.sub, { color: theme.subtext }]}>
              Community updates and notices
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Ionicons name="alert-circle-outline" size={36} color={theme.danger} />
              <Text style={[styles.emptyText, { color: theme.text }]}>{error}</Text>
              <TouchableOpacity
                style={[styles.retryBtn, { backgroundColor: theme.primary }]}
                onPress={() => loadAnnouncements()}>
                <Text style={[styles.retryText, { color: theme.primaryText }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.centered}>
              <Ionicons name="megaphone-outline" size={36} color={theme.inactive} />
              <Text style={[styles.emptyText, { color: theme.subtext }]}>No announcements yet</Text>
            </View>
          )
        }
        renderItem={renderItem}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  header: { marginBottom: 8 },
  heading: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3, marginBottom: 4 },
  sub: { fontSize: 14, marginBottom: 16 },
  cardTop: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-start' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardMeta: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  date: { fontSize: 12 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  typeText: { fontSize: 11, fontWeight: '600' },
  cardText: { fontSize: 14, lineHeight: 20 },
  adminMeta: { marginTop: 14, gap: 10 },
  lifecycleText: { fontSize: 12, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  actionText: { fontSize: 12, fontWeight: '700' },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  retryBtn: { marginTop: 4, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontSize: 14, fontWeight: '600' },
});
