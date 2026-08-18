import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { fetchVisitorHistory } from '../../api/visitors';
import { fetchMyHelperRequests } from '../../api/helpers';
import { fetchMyReports } from '../../api/reports';
import { fetchMyPaymentSubmissions } from '../../api/bills';
import { getAccessToken } from '../../api/client';
import { API_BASE_URL } from '../../config/api';

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString();
}

function formatAmount(value) {
  return `${Number(value || 0).toLocaleString('en-US')} MMK`;
}

function paymentCategory(item) {
  const bill = item?.bill_id;
  if (bill?.category && bill.category !== 'Combined') return bill.category;
  return bill?.type || 'Service Bill';
}

function paymentStatusColor(status, theme) {
  if (status === 'Approved') return theme.success;
  if (['Rejected', 'Resubmission Required'].includes(status)) {
    return theme.danger;
  }
  return theme.warning;
}

export default function ResidentActivityHistoryScreen({ navigation }) {
  const { theme } = useTheme();
  const [tab, setTab] = useState('visitors');
  const [visitors, setVisitors] = useState([]);
  const [helpers, setHelpers] = useState([]);
  const [reports, setReports] = useState([]);
  const [payments, setPayments] = useState([]);
  const [authToken, setAuthToken] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [visitorResult, helperResult, reportResult, paymentResult] =
        await Promise.all([
          fetchVisitorHistory({ limit: 100 }),
          fetchMyHelperRequests(),
          fetchMyReports({ limit: 100 }),
          fetchMyPaymentSubmissions({ limit: 100 }),
        ]);
      setVisitors(visitorResult.data || []);
      setHelpers(Array.isArray(helperResult) ? helperResult : []);
      setReports(Array.isArray(reportResult) ? reportResult : []);
      setPayments(Array.isArray(paymentResult) ? paymentResult : []);
      setAuthToken((await getAccessToken()) || '');
    } catch (err) {
      if (!err.sessionExpired)
        setError(err.message || 'Unable to load activity history');
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

  const data =
    tab === 'visitors'
      ? visitors
      : tab === 'helpers'
      ? helpers
      : tab === 'reports'
      ? reports
      : payments;

  const renderVisitor = ({ item }) => (
    <Card>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.primary + '18' }]}>
          <Ionicons name="person-outline" size={20} color={theme.primary} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.text }]}>
            {item.fullname}
          </Text>
          <Text style={[styles.meta, { color: theme.subtext }]}>
            Purpose: {item.purpose || 'General'}
          </Text>
          <Text style={[styles.meta, { color: theme.subtext }]}>
            Badge: {item.badgeNumber || 'Pending'}
          </Text>
          <Text style={[styles.date, { color: theme.inactive }]}>
            {formatDate(item.createdAt || item.visitDate)}
          </Text>
          {item.registration_type === 'PreRegistered' ? (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('VisitorPass', { visitorId: item._id })
              }
              style={[styles.passButton, { borderColor: theme.primary }]}
            >
              <Ionicons
                name="qr-code-outline"
                size={16}
                color={theme.primary}
              />
              <Text style={[styles.passButtonText, { color: theme.primary }]}>
                View visitor QR
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Card>
  );

  const renderHelper = ({ item }) => (
    <Card>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.primary + '18' }]}>
          <Ionicons name="people-outline" size={20} color={theme.primary} />
        </View>
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>
              {item.type}
            </Text>
            <Text style={[styles.status, { color: theme.primary }]}>
              {item.status}
            </Text>
          </View>
          <Text style={[styles.meta, { color: theme.subtext }]}>
            Preference: {item.gender_preferred || 'No Preference'}
          </Text>
          {item.helper_id?.fullname ? (
            <Text style={[styles.meta, { color: theme.subtext }]}>
              Helper: {item.helper_id.fullname}
            </Text>
          ) : null}
          {item.quoted_price_mmk != null ? (
            <Text style={[styles.meta, { color: theme.subtext }]}>
              Price: {Number(item.quoted_price_mmk).toLocaleString('en-US')} MMK
              {item.service_window ? ` · ${item.service_window}` : ''}
            </Text>
          ) : null}
          {item.note ? (
            <Text style={[styles.note, { color: theme.text }]}>
              {item.note}
            </Text>
          ) : null}
          <Text style={[styles.date, { color: theme.inactive }]}>
            {formatDate(item.created_at)}
          </Text>
        </View>
      </View>
    </Card>
  );

  const renderReport = ({ item }) => (
    <Card>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.primary + '18' }]}>
          <Ionicons
            name="document-text-outline"
            size={20}
            color={theme.primary}
          />
        </View>
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>
              {item.title}
            </Text>
            <Text style={[styles.status, { color: theme.primary }]}>
              {item.status}
            </Text>
          </View>
          <Text style={[styles.meta, { color: theme.subtext }]}>
            {item.type} · {item.location}
          </Text>
          <Text style={[styles.note, { color: theme.text }]}>
            {item.message}
          </Text>
          {item.submitted_at ? (
            <Text style={[styles.meta, { color: theme.success }]}>
              Acknowledged by administration
            </Text>
          ) : null}
          <Text style={[styles.date, { color: theme.inactive }]}>
            {formatDate(item.created_at)}
          </Text>
        </View>
      </View>
    </Card>
  );

  const renderPayment = ({ item }) => {
    const proofUri = item.proof_url ? `${API_BASE_URL}${item.proof_url}` : null;
    const statusColor = paymentStatusColor(item.status, theme);
    return (
      <Card>
        <View style={styles.paymentHeader}>
          <View
            style={[styles.icon, { backgroundColor: theme.primary + '18' }]}
          >
            <Ionicons name="wallet-outline" size={20} color={theme.primary} />
          </View>
          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: theme.text }]}>
                {paymentCategory(item)}
              </Text>
              <Text style={[styles.status, { color: statusColor }]}>
                {item.status}
              </Text>
            </View>
            <Text style={[styles.meta, { color: theme.subtext }]}>
              {item.bill_id?.title || 'Bill payment'}
            </Text>
            <Text style={[styles.paymentAmount, { color: theme.text }]}>
              {formatAmount(item.submitted_amount)}
            </Text>
            <Text style={[styles.meta, { color: theme.subtext }]}>
              Room {item.room_id?.room_name || 'Unknown'} · Expected{' '}
              {formatAmount(item.expected_amount)}
            </Text>
          </View>
        </View>

        {proofUri && authToken ? (
          <TouchableOpacity
            style={[styles.proofFrame, { borderColor: theme.border }]}
            onPress={() => setSelectedPayment(item)}
          >
            <Image
              source={{
                uri: proofUri,
                headers: { Authorization: `Bearer ${authToken}` },
              }}
              style={styles.proofImage}
              resizeMode="cover"
            />
            <View style={styles.proofOverlay}>
              <Ionicons name="expand-outline" size={17} color="#fff" />
              <Text style={styles.proofOverlayText}>
                View payment screenshot
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}

        <View style={[styles.paymentDates, { borderTopColor: theme.border }]}>
          <Text style={[styles.meta, { color: theme.subtext }]}>
            Submitted: {formatDate(item.submitted_at || item.created_at)}
          </Text>
          <Text style={[styles.meta, { color: theme.subtext }]}>
            {item.reviewed_at
              ? `Reviewed: ${formatDate(item.reviewed_at)}`
              : 'Reviewed: Waiting for Admin verification'}
          </Text>
          {item.bill_id?.paid_at ? (
            <Text style={[styles.meta, { color: theme.success }]}>
              Paid: {formatDate(item.bill_id.paid_at)}
            </Text>
          ) : null}
          {item.rejection_reason || item.admin_note ? (
            <Text style={[styles.note, { color: theme.text }]}>
              Admin: {item.rejection_reason || item.admin_note}
            </Text>
          ) : null}
        </View>
      </Card>
    );
  };

  const selectedProofUri = selectedPayment?.proof_url
    ? `${API_BASE_URL}${selectedPayment.proof_url}`
    : null;

  return (
    <ScreenContainer
      navigation={navigation}
      topBarVariant="stack"
      title="My Activity History"
      showBottomNav
    >
      <FlatList
        data={data}
        keyExtractor={item => item._id}
        renderItem={
          tab === 'visitors'
            ? renderVisitor
            : tab === 'helpers'
            ? renderHelper
            : tab === 'reports'
            ? renderReport
            : renderPayment
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[
                styles.tabs,
                { backgroundColor: theme.card },
              ]}
            >
              {[
                ['visitors', 'Visitors', 'person-outline'],
                ['helpers', 'Helpers', 'people-outline'],
                ['reports', 'Reports', 'document-text-outline'],
                ['payments', 'Payments', 'wallet-outline'],
              ].map(([value, label, icon]) => {
                const active = tab === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.tab,
                      active && { backgroundColor: theme.primary },
                    ]}
                    onPress={() => setTab(value)}
                  >
                    <Ionicons
                      name={icon}
                      size={17}
                      color={active ? theme.primaryText : theme.subtext}
                    />
                    <Text
                      style={[
                        styles.tabText,
                        { color: active ? theme.primaryText : theme.subtext },
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {error ? (
              <Text style={[styles.error, { color: theme.danger }]}>
                {error}
              </Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              style={styles.empty}
              size="large"
              color={theme.primary}
            />
          ) : (
            <Text style={[styles.empty, { color: theme.subtext }]}>
              No {tab} history yet
            </Text>
          )
        }
      />
      <Modal
        visible={Boolean(selectedPayment)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPayment(null)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setSelectedPayment(null)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {selectedProofUri && authToken ? (
            <Image
              source={{
                uri: selectedProofUri,
                headers: { Authorization: `Bearer ${authToken}` },
              }}
              style={styles.fullProof}
              resizeMode="contain"
            />
          ) : null}
          <View style={styles.modalCaption}>
            <Text style={styles.modalTitle}>
              {paymentCategory(selectedPayment)} ·{' '}
              {formatAmount(selectedPayment?.submitted_amount)}
            </Text>
            <Text style={styles.modalMeta}>
              Submitted {formatDate(selectedPayment?.submitted_at)}
            </Text>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 36, flexGrow: 1 },
  tabs: { padding: 4, borderRadius: 12, marginBottom: 16 },
  tab: {
    minWidth: 108,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: 9,
  },
  tabText: { fontSize: 13, fontWeight: '800' },
  row: { flexDirection: 'row' },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  copy: { flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '800', marginBottom: 5 },
  status: { fontSize: 11, fontWeight: '800' },
  meta: { fontSize: 13, lineHeight: 19 },
  note: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  date: { fontSize: 11, marginTop: 7 },
  passButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
  },
  passButtonText: { fontSize: 12, fontWeight: '800' },
  error: { textAlign: 'center', marginBottom: 12 },
  empty: { textAlign: 'center', paddingVertical: 48 },
  paymentHeader: { flexDirection: 'row' },
  paymentAmount: { fontSize: 18, fontWeight: '900', marginVertical: 5 },
  proofFrame: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 13,
  },
  proofImage: { width: '100%', height: 190 },
  proofOverlay: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#000a',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  proofOverlayText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  paymentDates: { borderTopWidth: 1, marginTop: 12, paddingTop: 10 },
  modalBackdrop: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  modalClose: {
    position: 'absolute',
    top: 48,
    right: 18,
    zIndex: 2,
    padding: 8,
  },
  fullProof: { width: '100%', height: '76%' },
  modalCaption: { position: 'absolute', left: 20, right: 20, bottom: 36 },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  modalMeta: { color: '#bbb', fontSize: 12, textAlign: 'center', marginTop: 5 },
});
