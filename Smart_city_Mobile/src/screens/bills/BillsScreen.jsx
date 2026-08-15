import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
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
  if (status === 'Overdue' || status === 'Rejected') {
    return {
      color: theme.danger,
      background: theme.dangerBg,
      icon: 'alert-circle',
    };
  }
  if (
    ['Payment Submitted', 'Under Review', 'Pending Verification'].includes(
      status,
    )
  ) {
    return {
      color: theme.primary,
      background: theme.primaryBg,
      icon: 'shield-checkmark-outline',
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
  const [selectedBill, setSelectedBill] = useState(null);
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
      <TouchableOpacity
        onPress={() => setSelectedBill(item)}
        activeOpacity={0.84}
      >
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
                  <Ionicons
                    name="home-outline"
                    size={13}
                    color={theme.subtext}
                  />
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
          <Text style={[styles.detailsHint, { color: theme.primary }]}>
            View bill details
          </Text>
        </Card>
      </TouchableOpacity>
    );
  };

  const componentRows = selectedBill
    ? [
        ['Electricity', selectedBill.electricity_amount],
        ['Water', selectedBill.water_amount],
        ['Apartment installment', selectedBill.installment_amount],
        ['Maintenance', selectedBill.maintenance_amount],
        ['Service fee', selectedBill.service_amount],
        [selectedBill.other_description || 'Other', selectedBill.other_amount],
      ].filter(([, amount]) => Number(amount || 0) > 0)
    : [];

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
            {isAdmin ? (
              <View style={styles.adminActions}>
                <TouchableOpacity
                  style={[
                    styles.adminButton,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={() => navigation.navigate('CreateMonthlyBill')}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={18}
                    color={theme.primaryText}
                  />
                  <Text
                    style={[
                      styles.adminButtonText,
                      { color: theme.primaryText },
                    ]}
                  >
                    Create bill
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.adminButton,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                  onPress={() => navigation.navigate('AdminPaymentReview')}
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={18}
                    color={theme.primary}
                  />
                  <Text style={[styles.adminButtonText, { color: theme.text }]}>
                    Verify payments
                  </Text>
                </TouchableOpacity>
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

      <Modal
        visible={Boolean(selectedBill)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedBill(null)}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: theme.card }]}>
            <View style={styles.sheetHeader}>
              <View style={styles.details}>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>
                  Bill details
                </Text>
                <Text style={[styles.sheetSubtitle, { color: theme.subtext }]}>
                  {selectedBill?.title || 'Service bill'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedBill(null)}>
                <Ionicons name="close" size={26} color={theme.icon} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.sheetContent}>
              <View
                style={[styles.detailSummary, { backgroundColor: theme.input }]}
              >
                <Text style={[styles.detailLabel, { color: theme.subtext }]}>
                  Total due
                </Text>
                <Text style={[styles.detailTotal, { color: theme.text }]}>
                  {formatAmount(selectedBill?.amount)}
                </Text>
                <Text style={[styles.sheetSubtitle, { color: theme.subtext }]}>
                  Due {formatDate(selectedBill?.due_date)} ·{' '}
                  {selectedBill?.status}
                </Text>
              </View>

              {selectedBill?.status !== 'Paid' ? (
                <View
                  style={[
                    styles.cutoffWarning,
                    { backgroundColor: theme.warningBg },
                  ]}
                >
                  <Ionicons
                    name="warning-outline"
                    size={20}
                    color={theme.warning}
                  />
                  <View style={styles.details}>
                    <Text style={[styles.warningTitle, { color: theme.text }]}>
                      Payment deadline warning
                    </Text>
                    <Text
                      style={[styles.warningText, { color: theme.subtext }]}
                    >
                      {selectedBill?.service_cutoff_warning ||
                        'Pay within 7 days. Electricity and water services may be suspended after the due date if this bill remains unpaid.'}
                    </Text>
                  </View>
                </View>
              ) : null}

              <Text style={[styles.breakdownTitle, { color: theme.text }]}>
                Monthly breakdown
              </Text>
              {componentRows.length ? (
                componentRows.map(([label, amount]) => (
                  <View
                    key={label}
                    style={[
                      styles.breakdownRow,
                      { borderBottomColor: theme.border },
                    ]}
                  >
                    <Text
                      style={[styles.breakdownLabel, { color: theme.subtext }]}
                    >
                      {label}
                    </Text>
                    <Text
                      style={[styles.breakdownAmount, { color: theme.text }]}
                    >
                      {formatAmount(amount)}
                    </Text>
                  </View>
                ))
              ) : (
                <View
                  style={[
                    styles.breakdownRow,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <Text
                    style={[styles.breakdownLabel, { color: theme.subtext }]}
                  >
                    {selectedBill?.type || 'Service charge'}
                  </Text>
                  <Text style={[styles.breakdownAmount, { color: theme.text }]}>
                    {formatAmount(selectedBill?.amount)}
                  </Text>
                </View>
              )}

              {isAdmin ? (
                <View
                  style={[styles.adminDetail, { backgroundColor: theme.input }]}
                >
                  <Text style={[styles.detailLabel, { color: theme.subtext }]}>
                    Resident account
                  </Text>
                  <Text style={[styles.adminDetailText, { color: theme.text }]}>
                    Room {selectedBill?.room_id?.room_name || 'Unknown'} ·{' '}
                    {selectedBill?.room_id?.resident_id?.fullname ||
                      'Unknown resident'}
                  </Text>
                  <Text style={[styles.detailLabel, { color: theme.subtext }]}>
                    Latest payment
                  </Text>
                  <Text style={[styles.adminDetailText, { color: theme.text }]}>
                    {selectedBill?.latest_payment?.status ||
                      'No screenshot submitted'}
                  </Text>
                </View>
              ) : null}

              {selectedBill?.room_id?.purchase_price ? (
                <View
                  style={[styles.adminDetail, { backgroundColor: theme.input }]}
                >
                  <Text style={[styles.detailLabel, { color: theme.subtext }]}>
                    Room purchase plan
                  </Text>
                  <Text style={[styles.adminDetailText, { color: theme.text }]}>
                    {selectedBill.room_id.room_type} ·{' '}
                    {formatAmount(selectedBill.room_id.purchase_price)}
                  </Text>
                  <Text style={[styles.detailLabel, { color: theme.subtext }]}>
                    40% paid
                  </Text>
                  <Text style={[styles.adminDetailText, { color: theme.text }]}>
                    {formatAmount(selectedBill.room_id.down_payment_amount)}
                  </Text>
                  <Text style={[styles.detailLabel, { color: theme.subtext }]}>
                    60-month plan
                  </Text>
                  <Text style={[styles.adminDetailText, { color: theme.text }]}>
                    {formatAmount(
                      selectedBill.room_id.monthly_installment_amount,
                    )}{' '}
                    monthly · {selectedBill.room_id.installments_paid || 0}/
                    {selectedBill.room_id.installment_months || 60} paid
                  </Text>
                </View>
              ) : null}

              {!isAdmin && selectedBill?.status !== 'Paid' ? (
                <TouchableOpacity
                  style={[styles.payButton, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    const bill = selectedBill;
                    setSelectedBill(null);
                    navigation.navigate('BillPayment', {
                      billId: bill._id,
                      bill,
                    });
                  }}
                >
                  <Ionicons
                    name="wallet-outline"
                    size={20}
                    color={theme.primaryText}
                  />
                  <Text
                    style={[styles.payButtonText, { color: theme.primaryText }]}
                  >
                    Pay Now
                  </Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  adminActions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  adminButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 10,
    paddingVertical: 11,
  },
  adminButtonText: { fontSize: 12, fontWeight: '800' },
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
  detailsHint: { fontSize: 11, fontWeight: '700', marginTop: 10 },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#000000AA',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
  },
  sheetTitle: { fontSize: 21, fontWeight: '900' },
  sheetSubtitle: { fontSize: 13, marginTop: 4 },
  sheetContent: { paddingHorizontal: 18, paddingBottom: 40 },
  detailSummary: { borderRadius: 12, padding: 15 },
  detailLabel: { fontSize: 11, fontWeight: '700', marginBottom: 5 },
  detailTotal: { fontSize: 27, fontWeight: '900' },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  breakdownLabel: { flex: 1, fontSize: 13 },
  breakdownAmount: { fontSize: 13, fontWeight: '800' },
  adminDetail: { borderRadius: 12, padding: 14, marginTop: 14 },
  adminDetailText: { fontSize: 13, fontWeight: '700', marginBottom: 12 },
  cutoffWarning: {
    flexDirection: 'row',
    gap: 9,
    borderRadius: 12,
    padding: 13,
    marginTop: 12,
  },
  warningTitle: { fontSize: 13, fontWeight: '800' },
  warningText: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 15,
    marginTop: 18,
  },
  payButtonText: { fontSize: 16, fontWeight: '900' },
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
