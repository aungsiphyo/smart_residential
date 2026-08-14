import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ScreenContainer from '../../components/ScreenContainer';
import Card from '../../components/Card';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { fetchBills } from '../../api/bills';

const SERVICE_ICONS = {
  Water: 'water-outline',
  Electricity: 'flash-outline',
  Maintenance: 'build-outline',
  General: 'receipt-outline',
};

function formatAmount(value) {
  return `${Number(value || 0).toLocaleString('en-US')} MMK`;
}

function formatDate(value) {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getStatusTheme(status, theme) {
  if (status === 'Paid') {
    return {
      color: theme.success,
      background: theme.successBg,
      icon: 'checkmark-circle',
    };
  }
  if (status === 'Overdue') {
    return {
      color: theme.danger,
      background: theme.dangerBg,
      icon: 'alert-circle',
    };
  }

  return {
    color: theme.warning,
    background: theme.warningBg,
    icon: 'time-outline',
  };
}

export default function BillsScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const isAdmin = ['Admin', 'Staff'].includes(user?.role);

  const loadBills = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      setBills(await fetchBills());
    } catch (err) {
      if (!err.sessionExpired) {
        setError(err.message || 'Unable to load service bills');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBills();
    }, [loadBills]),
  );

  const outstandingTotal = useMemo(
    () =>
      bills
        .filter(bill => bill.status !== 'Paid')
        .reduce((sum, bill) => sum + Number(bill.amount || 0), 0),
    [bills],
  );

  const renderBill = ({ item }) => {
    const room =
      item.room_id && typeof item.room_id === 'object' ? item.room_id : null;
    const resident = room?.resident_id;
    const service = item.type || item.service || 'General';
    const statusTheme = getStatusTheme(item.status, theme);

    return (
      <Card>
        <View style={styles.row}>
          <View
            style={[
              styles.serviceIcon,
              { backgroundColor: theme.primary + '18' },
            ]}
          >
            <Ionicons
              name={SERVICE_ICONS[service] || SERVICE_ICONS.General}
              size={22}
              color={theme.primary}
            />
          </View>
          <View style={styles.details}>
            <Text
              style={[styles.service, { color: theme.text }]}
              numberOfLines={2}
            >
              {item.title || `${service} bill`}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons
                name="calendar-outline"
                size={13}
                color={theme.subtext}
              />
              <Text style={[styles.due, { color: theme.subtext }]}>
                Due {formatDate(item.due_date)}
              </Text>
            </View>
            {isAdmin ? (
              <View style={styles.metaRow}>
                <Ionicons name="home-outline" size={13} color={theme.subtext} />
                <Text
                  style={[styles.due, { color: theme.subtext }]}
                  numberOfLines={1}
                >
                  Room {room?.room_name || 'Unassigned'}
                  {resident?.fullname || room?.owner_name
                    ? ` · ${resident?.fullname || room?.owner_name}`
                    : ''}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.right}>
            <Text style={[styles.amount, { color: theme.text }]}>
              {formatAmount(item.amount)}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusTheme.background },
              ]}
            >
              <Ionicons
                name={statusTheme.icon}
                size={12}
                color={statusTheme.color}
              />
              <Text style={[styles.status, { color: statusTheme.color }]}>
                {item.status}
              </Text>
            </View>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <ScreenContainer navigation={navigation}>
      <FlatList
        data={bills}
        keyExtractor={item => String(item._id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadBills(true)}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.heading, { color: theme.text }]}>
              Service Bills
            </Text>
            <Text style={[styles.sub, { color: theme.subtext }]}>
              {isAdmin
                ? 'All resident bills, grouped by room'
                : user?.room_number
                ? `Bills for Unit ${user.room_number}`
                : 'Bills for your linked room'}
            </Text>
            {!loading && bills.length > 0 ? (
              <View
                style={[
                  styles.summary,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.summaryLabel, { color: theme.subtext }]}>
                  Outstanding
                </Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {formatAmount(outstandingTotal)}
                </Text>
              </View>
            ) : null}
            {error ? (
              <View style={[styles.errorBanner, { borderColor: theme.danger }]}>
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color={theme.danger}
                />
                <Text style={[styles.errorText, { color: theme.text }]}>
                  {error}
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <View style={styles.centered}>
              <Ionicons
                name="receipt-outline"
                size={38}
                color={theme.inactive}
              />
              <Text style={[styles.emptyText, { color: theme.subtext }]}>
                No service bills found
              </Text>
              {error ? (
                <TouchableOpacity
                  style={[
                    styles.retryButton,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={() => loadBills()}
                >
                  <Text
                    style={[styles.retryText, { color: theme.primaryText }]}
                  >
                    Retry
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )
        }
        renderItem={renderBill}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  header: { marginBottom: 8 },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sub: { fontSize: 14, marginBottom: 14 },
  summary: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  summaryLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { flex: 1, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  serviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  details: { flex: 1, paddingRight: 8 },
  service: { fontSize: 15, fontWeight: '700', marginBottom: 5 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  due: { flex: 1, fontSize: 12 },
  right: { alignItems: 'flex-end', maxWidth: '38%' },
  amount: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 7,
    textAlign: 'right',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  status: { fontSize: 11, fontWeight: '700' },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyText: { fontSize: 15, textAlign: 'center' },
  retryButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontSize: 14, fontWeight: '700' },
});
