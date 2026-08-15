import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Card from '../../components/Card';
import ScreenContainer from '../../components/ScreenContainer';
import {
  fetchPaymentSubmissions,
  reviewPaymentSubmission,
} from '../../api/bills';
import { getAccessToken } from '../../api/client';
import { API_BASE_URL } from '../../config/api';
import { useTheme } from '../../context/ThemeContext';

const ACTIVE_STATUSES = new Set(['Pending', 'Under Review']);

function formatAmount(value) {
  return `${Number(value || 0).toLocaleString('en-US')} MMK`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
}

export default function AdminPaymentReviewScreen({ navigation }) {
  const { theme } = useTheme();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState(false);
  const [reasonAction, setReasonAction] = useState(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [submissions, accessToken] = await Promise.all([
        fetchPaymentSubmissions({ limit: 100 }),
        getAccessToken(),
      ]);
      setItems(submissions);
      setToken(accessToken || '');
    } catch (err) {
      if (!err.sessionExpired) {
        Alert.alert(
          'Unable to load payments',
          err.message || 'Please try again.',
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const activeDifference =
          Number(ACTIVE_STATUSES.has(b.status)) -
          Number(ACTIVE_STATUSES.has(a.status));
        return (
          activeDifference ||
          new Date(b.submitted_at) - new Date(a.submitted_at)
        );
      }),
    [items],
  );
  const selectedBreakdown = selected?.bill_id
    ? [
        ['Electricity', selected.bill_id.electricity_amount],
        ['Water', selected.bill_id.water_amount],
        ['Apartment installment', selected.bill_id.installment_amount],
        ['Maintenance', selected.bill_id.maintenance_amount],
        ['Service fee', selected.bill_id.service_amount],
        [
          selected.bill_id.other_description || 'Other',
          selected.bill_id.other_amount,
        ],
      ].filter(([, amount]) => Number(amount || 0) > 0)
    : [];

  const performReview = async (action, extra = {}) => {
    if (!selected?._id || working) return;
    setWorking(true);
    try {
      const response = await reviewPaymentSubmission(selected._id, {
        action,
        ...extra,
      });
      Alert.alert(
        action === 'approve'
          ? 'Payment approved'
          : action === 'under_review'
          ? 'Marked Under Review'
          : 'Payment updated',
        action === 'approve'
          ? 'The database transaction completed and the bill is now Paid.'
          : action === 'under_review'
          ? 'The payment remains active while Admin verifies it.'
          : 'The resident will receive the payment status update.',
      );
      setSelected(null);
      setReasonAction(null);
      setReason('');
      await load(true);
      return response;
    } catch (err) {
      if (!err.sessionExpired) {
        Alert.alert('Review failed', err.message || 'Please try again.');
      }
      return null;
    } finally {
      setWorking(false);
    }
  };

  const confirmApproval = () => {
    Alert.alert(
      'Approve exact payment?',
      `Confirm the screenshot shows ${formatAmount(
        selected?.expected_amount,
      )} sent to the Prime City KPay account. This atomically marks the bill Paid.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve payment', onPress: () => performReview('approve') },
      ],
    );
  };

  const submitReason = () => {
    if (!reason.trim()) {
      Alert.alert('Reason required', 'Enter a clear reason for the resident.');
      return;
    }
    performReview(reasonAction, { reason: reason.trim() });
  };

  const renderItem = ({ item }) => {
    const active = ACTIVE_STATUSES.has(item.status);
    return (
      <TouchableOpacity onPress={() => setSelected(item)} activeOpacity={0.82}>
        <Card>
          <View style={styles.cardTop}>
            <View style={styles.flex}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Room {item.room_id?.room_name || 'Unknown'} ·{' '}
                {item.user_id?.fullname || 'Resident'}
              </Text>
              <Text style={[styles.meta, { color: theme.subtext }]}>
                {item.bill_id?.title || 'Service bill'} ·{' '}
                {formatDate(item.submitted_at)}
              </Text>
            </View>
            <View
              style={[
                styles.badge,
                { backgroundColor: active ? theme.warningBg : theme.successBg },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: active ? theme.warning : theme.success },
                ]}
              >
                {item.status}
              </Text>
            </View>
          </View>
          <Text style={[styles.cardAmount, { color: theme.text }]}>
            {formatAmount(item.submitted_amount)}
          </Text>
          <Text style={[styles.tapHint, { color: theme.primary }]}>
            View private proof and review
          </Text>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer
      navigation={navigation}
      topBarVariant="stack"
      title="Payment Verification"
    >
      <FlatList
        data={sortedItems}
        keyExtractor={item => String(item._id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.heading, { color: theme.text }]}>
              Resident payment proofs
            </Text>
            <Text style={[styles.sub, { color: theme.subtext }]}>
              A screenshot alone never marks a bill Paid.
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              size="large"
              color={theme.primary}
              style={styles.empty}
            />
          ) : (
            <View style={styles.empty}>
              <Ionicons
                name="shield-checkmark-outline"
                size={38}
                color={theme.inactive}
              />
              <Text style={[styles.sub, { color: theme.subtext }]}>
                No payment submissions found
              </Text>
            </View>
          )
        }
      />

      <Modal
        visible={Boolean(selected)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: theme.card }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>
                Verify payment
              </Text>
              <TouchableOpacity
                onPress={() => setSelected(null)}
                disabled={working}
              >
                <Ionicons name="close" size={26} color={theme.icon} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.sheetContent}>
              <Image
                source={{
                  uri: `${API_BASE_URL}${selected?.proof_url || ''}`,
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                }}
                style={styles.proof}
                resizeMode="contain"
              />
              <View
                style={[styles.verifyBox, { backgroundColor: theme.input }]}
              >
                <Text style={[styles.verifyLabel, { color: theme.subtext }]}>
                  Expected exact amount
                </Text>
                <Text style={[styles.verifyAmount, { color: theme.text }]}>
                  {formatAmount(selected?.expected_amount)}
                </Text>
                <Text style={[styles.verifyMeta, { color: theme.subtext }]}>
                  Submitted: {formatAmount(selected?.submitted_amount)} · Room{' '}
                  {selected?.room_id?.room_name}
                </Text>
              </View>
              <View style={[styles.identityBox, { borderColor: theme.border }]}>
                <Text style={[styles.detailHeading, { color: theme.text }]}>
                  Resident and room
                </Text>
                <Text style={[styles.detailLine, { color: theme.text }]}>
                  {selected?.user_id?.fullname || 'Unknown resident'} · Room{' '}
                  {selected?.room_id?.room_name || 'Unknown'}
                </Text>
                <Text style={[styles.detailMeta, { color: theme.subtext }]}>
                  {selected?.user_id?.phone || 'No phone'} ·{' '}
                  {selected?.room_id?.room_type || 'Unknown room type'}
                </Text>
                <Text style={[styles.detailMeta, { color: theme.subtext }]}>
                  Submitted {formatDate(selected?.submitted_at)}
                </Text>
              </View>
              <View style={[styles.identityBox, { borderColor: theme.border }]}>
                <Text style={[styles.detailHeading, { color: theme.text }]}>
                  Bill details
                </Text>
                {selectedBreakdown.map(([label, amount]) => (
                  <View key={label} style={styles.breakdownRow}>
                    <Text style={[styles.detailMeta, { color: theme.subtext }]}>
                      {label}
                    </Text>
                    <Text
                      style={[styles.breakdownAmount, { color: theme.text }]}
                    >
                      {formatAmount(amount)}
                    </Text>
                  </View>
                ))}
                <View style={[styles.breakdownRow, styles.totalRow]}>
                  <Text style={[styles.detailHeading, { color: theme.text }]}>
                    Total
                  </Text>
                  <Text style={[styles.breakdownAmount, { color: theme.text }]}>
                    {formatAmount(selected?.bill_id?.amount)}
                  </Text>
                </View>
                <Text style={[styles.detailMeta, { color: theme.subtext }]}>
                  Due {formatDate(selected?.bill_id?.due_date)} · Bill status{' '}
                  {selected?.bill_id?.status || 'Unknown'}
                </Text>
              </View>
              {selected?.user_note ? (
                <Text style={[styles.note, { color: theme.subtext }]}>
                  Resident note: {selected.user_note}
                </Text>
              ) : null}

              {ACTIVE_STATUSES.has(selected?.status) ? (
                <>
                  {selected.status === 'Pending' ? (
                    <TouchableOpacity
                      style={[
                        styles.reviewButton,
                        { borderColor: theme.warning },
                      ]}
                      onPress={() => performReview('under_review')}
                      disabled={working}
                    >
                      <Text
                        style={[
                          styles.reviewButtonText,
                          { color: theme.warning },
                        ]}
                      >
                        Mark Under Review
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[
                      styles.approveButton,
                      { backgroundColor: theme.success },
                    ]}
                    onPress={confirmApproval}
                    disabled={working}
                  >
                    {working ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#FFFFFF"
                      />
                    )}
                    <Text style={styles.approveText}>
                      Approve and mark Paid
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.twoActions}>
                    <TouchableOpacity
                      style={[
                        styles.secondaryAction,
                        { borderColor: theme.warning },
                      ]}
                      onPress={() => setReasonAction('resubmission')}
                      disabled={working}
                    >
                      <Text
                        style={[styles.secondaryText, { color: theme.warning }]}
                      >
                        Request resubmission
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.secondaryAction,
                        { borderColor: theme.danger },
                      ]}
                      onPress={() => setReasonAction('reject')}
                      disabled={working}
                    >
                      <Text
                        style={[styles.secondaryText, { color: theme.danger }]}
                      >
                        Reject
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <Text style={[styles.finalStatus, { color: theme.subtext }]}>
                  Final status: {selected?.status}
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(reasonAction)}
        transparent
        animationType="fade"
        onRequestClose={() => setReasonAction(null)}
      >
        <View style={styles.centerOverlay}>
          <View style={[styles.reasonCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>
              {reasonAction === 'reject'
                ? 'Reject payment'
                : 'Request resubmission'}
            </Text>
            <TextInput
              style={[
                styles.reasonInput,
                {
                  color: theme.text,
                  backgroundColor: theme.input,
                  borderColor: theme.border,
                },
              ]}
              value={reason}
              onChangeText={setReason}
              placeholder="Reason shown to resident"
              placeholderTextColor={theme.inactive}
              multiline
              maxLength={240}
            />
            <View style={styles.twoActions}>
              <TouchableOpacity
                style={[styles.secondaryAction, { borderColor: theme.border }]}
                onPress={() => setReasonAction(null)}
              >
                <Text style={[styles.secondaryText, { color: theme.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.secondaryAction,
                  { backgroundColor: theme.primary },
                ]}
                onPress={submitReason}
              >
                <Text
                  style={[styles.secondaryText, { color: theme.primaryText }]}
                >
                  Submit
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 36, flexGrow: 1 },
  header: { marginBottom: 10 },
  heading: { fontSize: 23, fontWeight: '800', marginBottom: 4 },
  sub: { fontSize: 13, lineHeight: 19 },
  cardTop: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  meta: { fontSize: 12, marginTop: 5 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    alignSelf: 'flex-start',
  },
  badgeText: { fontWeight: '800', fontSize: 11 },
  cardAmount: { fontSize: 19, fontWeight: '900', marginTop: 12 },
  tapHint: { fontSize: 12, fontWeight: '700', marginTop: 8 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#000000AA',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
  },
  sheetTitle: { fontSize: 19, fontWeight: '900' },
  sheetContent: { padding: 16, paddingTop: 0, paddingBottom: 36 },
  proof: {
    width: '100%',
    height: 360,
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  verifyBox: { borderRadius: 11, padding: 14, marginTop: 12 },
  verifyLabel: { fontSize: 12, fontWeight: '700' },
  verifyAmount: { fontSize: 24, fontWeight: '900', marginTop: 4 },
  verifyMeta: { fontSize: 12, marginTop: 6 },
  note: { fontSize: 13, lineHeight: 19, marginTop: 10 },
  identityBox: { borderWidth: 1, borderRadius: 11, padding: 13, marginTop: 10 },
  detailHeading: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
  detailLine: { fontSize: 14, fontWeight: '700' },
  detailMeta: { fontSize: 12, lineHeight: 18 },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 3,
  },
  breakdownAmount: { fontSize: 12, fontWeight: '800', textAlign: 'right' },
  totalRow: { marginTop: 5, paddingTop: 8 },
  reviewButton: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  reviewButtonText: { fontSize: 14, fontWeight: '800' },
  approveButton: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    padding: 14,
    marginTop: 10,
  },
  approveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  twoActions: { flexDirection: 'row', gap: 9, marginTop: 10 },
  secondaryAction: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 11,
    alignItems: 'center',
  },
  secondaryText: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  finalStatus: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 16,
  },
  centerOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000AA',
    padding: 20,
  },
  reasonCard: { width: '100%', borderRadius: 16, padding: 18 },
  reasonInput: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    textAlignVertical: 'top',
    marginTop: 14,
  },
});
