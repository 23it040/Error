import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import donationService from '../../services/donation.service';
import requestService from '../../services/request.service';
import matchingService from '../../services/matching.service';
import { getFoodImageUrl } from '../../utils/image';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import NGOMap from '../../components/maps/NGOMap';
import NGORecommendationCard from '../../components/donor/NGORecommendationCard';
import NearbyNGOCard from '../../components/donor/NearbyNGOCard';
import AIFoodSpoilageRiskCard from '../../components/ai/AIFoodSpoilageRiskCard';
import toast from 'react-hot-toast';
import {
  FiMapPin, FiBox, FiImage, FiAward, FiAlertCircle, FiInfo,
  FiPhone, FiMail, FiCheckCircle, FiXCircle, FiShield, FiRefreshCw,
  FiNavigation, FiActivity, FiCheck, FiX
} from 'react-icons/fi';

const formatMatchScore = (score) => {
  if (score === undefined || score === null) return '0%';
  const val = Number(score);
  if (isNaN(val)) return '0%';
  if (val <= 1.0 && val > 0) return `${Math.round(val * 100)}%`;
  return `${Math.round(val)}%`;
};

const DonationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const [donation, setDonation] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [respondingId, setRespondingId] = useState(null);
  const [selectedNgoModal, setSelectedNgoModal] = useState(null);
  const [highlightedNgoId, setHighlightedNgoId] = useState(null);

  const [matchesState, setMatchesState] = useState({
    recommendations: [],
    nearbyUnverified: [],
    aiAvailable: true,
    loading: true,
    donation: null,
    locationRequired: false,
    backendError: null,
    placesError: null,
    totalCount: 0
  });

  // Fetch donation, requests, and enhanced NGO matches
  useEffect(() => {
    let mounted = true;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const d = await donationService.getDonation(id);
        if (!mounted) return;
        const dObj = d?.data || d;
        setDonation(dObj);

        // Fetch requests (non-blocking)
        try {
          const reqs = await requestService.listRequests({ donationId: id });
          if (mounted) setRequests(Array.isArray(reqs) ? reqs : Array.isArray(reqs?.data) ? reqs.data : []);
        } catch (e) {
          // Requests optional
        }

        // Fetch enhanced NGO matches (multi-source: backend AI + Google Places)
        try {
          const donLat = dObj?.latitude;
          const donLng = dObj?.longitude;
          const donationLocation = (donLat && donLng) ? { lat: donLat, lng: donLng } : null;

          const result = await matchingService.getEnhancedDonationMatches(id, donationLocation);
          if (mounted) {
            setMatchesState({
              recommendations: result.recommendations || [],
              nearbyUnverified: result.nearbyUnverified || [],
              aiAvailable: result.aiAvailable !== false,
              loading: false,
              donation: result.donation || null,
              locationRequired: result.locationRequired || false,
              backendError: result.backendError || null,
              placesError: result.placesError || null,
              totalCount: result.totalCount || 0
            });
          }
        } catch (mErr) {
          console.warn('Failed to load NGO matches:', mErr);
          if (mounted) {
            setMatchesState(prev => ({
              ...prev,
              loading: false,
              backendError: mErr.message || 'Matching service unavailable'
            }));
          }
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load donation details');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchAll();
    return () => (mounted = false);
  }, [id]);

  const handleRespond = async (requestId, action) => {
    if (!requestId || respondingId || respondingTo) return;
    setRespondingId(requestId);
    setRespondingTo(requestId);
    try {
      await requestService.updateRequestStatus(requestId, action === 'accept' ? 'ACCEPTED' : 'REJECTED');
      toast.success(`Request ${action === 'accept' ? 'accepted' : 'rejected'}`);
      const reqs = await requestService.listRequests({ donationId: id });
      setRequests(Array.isArray(reqs) ? reqs : Array.isArray(reqs?.data) ? reqs.data : []);
    } catch (err) {
      console.error('Request update failure:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to update request';
      toast.error(errMsg);
    } finally {
      setRespondingId(null);
      setRespondingTo(null);
    }
  };

  // "View on Map" handler: scroll to map, center on NGO
  const handleViewOnMap = useCallback((ngo) => {
    setHighlightedNgoId(ngo.ngoId || ngo.id);
    if (mapRef.current) {
      mapRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Retry matches
  const handleRetryMatches = useCallback(async () => {
    if (!donation) return;
    setMatchesState(prev => ({ ...prev, loading: true }));
    try {
      const donLat = donation.latitude;
      const donLng = donation.longitude;
      const donationLocation = (donLat && donLng) ? { lat: donLat, lng: donLng } : null;
      const result = await matchingService.getEnhancedDonationMatches(id, donationLocation);
      setMatchesState({
        recommendations: result.recommendations || [],
        nearbyUnverified: result.nearbyUnverified || [],
        aiAvailable: result.aiAvailable !== false,
        loading: false,
        donation: result.donation || null,
        locationRequired: result.locationRequired || false,
        backendError: result.backendError || null,
        placesError: result.placesError || null,
        totalCount: result.totalCount || 0
      });
    } catch (err) {
      setMatchesState(prev => ({
        ...prev,
        loading: false,
        backendError: err.message || 'Retry failed'
      }));
    }
  }, [donation, id]);

  if (loading) return <div className="py-12 text-center"><Spinner size={48} /></div>;
  if (!donation) return <EmptyState title="Not found" description="Donation record does not exist." />;

  // Map center: use real donation coords, fallback to null (map handles gracefully)
  const donLat = donation.latitude;
  const donLng = donation.longitude;
  const hasValidCoords = donLat && donLng && Number.isFinite(donLat) && Number.isFinite(donLng);

  // Combine all NGOs for map markers
  const allMapNgos = [
    ...matchesState.recommendations
      .filter((m) => m.latitude && m.longitude)
      .map((m) => ({
        id: m.ngoId || m.id,
        name: m.ngoName || m.name,
        organizationName: m.ngoName || m.name,
        address: m.city || m.address || 'Partner NGO',
        latitude: m.latitude,
        longitude: m.longitude,
        lat: m.latitude,
        lng: m.longitude,
        capacity: m.capacity || 150,
        isVerified: true,
        matchScore: formatMatchScore(m.matchScore)
      })),
    ...matchesState.nearbyUnverified
      .filter((n) => (n.latitude || n.lat) && (n.longitude || n.lng))
      .map((n) => ({
        id: n.id || n._id,
        name: n.name || n.organizationName,
        organizationName: n.name || n.organizationName,
        address: n.address || 'Nearby Organization',
        latitude: n.latitude || n.lat,
        longitude: n.longitude || n.lng,
        lat: n.latitude || n.lat,
        lng: n.longitude || n.lng,
        isVerified: false,
        source: 'google_places'
      }))
  ];

  // Determine what notices to show
  const hasRecommendations = matchesState.recommendations.length > 0;
  const hasNearbyUnverified = matchesState.nearbyUnverified.length > 0;
  const totalFailure = !hasRecommendations && !hasNearbyUnverified && matchesState.backendError && matchesState.placesError;

  return (
    <section className="py-6 space-y-6">
      <PageHeader title={donation.foodName || donation.name || 'Donation Details'} subtitle="Review donation status and incoming requests" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Donation Overview" icon={<FiBox className="h-5 w-5" />}>
          <div className="flex flex-col gap-4">
            {(!imageError && getFoodImageUrl(donation)) ? (
              <img
                src={getFoodImageUrl(donation)}
                alt={donation.foodName || donation.name || 'Food Donation'}
                onError={() => setImageError(true)}
                className="h-56 w-full rounded-2xl object-cover border border-[#E6DED6] shadow-sm"
              />
            ) : (
              <div className="h-56 w-full rounded-2xl border border-[#E6DED6] bg-[#FAF7F2] flex flex-col items-center justify-center gap-2 text-[#626760] shadow-xs p-4 text-center">
                <FiImage className="h-10 w-10 text-[#BD715C]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#626760]">No image uploaded</span>
                <span className="text-[11px] text-[#A8ADA5] font-medium">Donor did not attach a food photo</span>
              </div>
            )}
            <div className="space-y-2 text-xs font-medium text-[#292B29]">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary">{donation.category || 'General'}</Badge>
                <Badge variant="success">{donation.status || 'AVAILABLE'}</Badge>
              </div>
              <div><span className="font-bold text-[#626760] uppercase tracking-wider block text-[10px]">Quantity</span> <span className="text-sm font-extrabold text-[#BD715C]">{donation.quantity} {donation.unit || 'servings'}</span></div>
              <div><span className="font-bold text-[#626760] uppercase tracking-wider block text-[10px]">Pickup Address</span> <span className="font-semibold text-[#292B29]">{donation.pickupAddress || 'Address not specified'}</span></div>
              <div><span className="font-bold text-[#626760] uppercase tracking-wider block text-[10px]">Expiry</span> <span className="text-amber-700 font-bold">{donation.expiryTime || 'N/A'}</span></div>
              {donation.description && (
                <div className="pt-2 border-t border-slate-100 text-slate-600 leading-relaxed text-[11px]">{donation.description}</div>
              )}
            </div>
          </div>
        </Card>

        <Card title="NGO Requests" className="lg:col-span-2">
          {(() => {
            const pendingRequests = requests.filter(
              (r) => !r.status || r.status === 'PENDING'
            );
            return pendingRequests.length === 0 ? (
              <EmptyState title="No pending requests" description="No NGOs have requested this donation yet." />
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((r) => (
                  <div key={r._id || r.id} className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-4 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{r.ngoName || r.requestedByName}</div>
                      <div className="text-sm text-slate-600 mt-0.5">{r.message}</div>
                      <div className="text-xs text-slate-400 mt-1">Distance: {r.distance || '—'}</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="primary"
                        onClick={() => handleRespond(r._id || r.id, 'accept')}
                        loading={respondingId === (r._id || r.id) || respondingTo === (r._id || r.id)}
                        disabled={respondingId !== null || respondingTo !== null}
                      >
                        <FiCheck className="h-4 w-4" />
                        Accept
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleRespond(r._id || r.id, 'reject')}
                        disabled={respondingId !== null || respondingTo !== null}
                        className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold border-2 border-red-400 bg-white text-red-500 hover:bg-red-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                      >
                        {(respondingId === (r._id || r.id) || respondingTo === (r._id || r.id)) ? (
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                        ) : (
                          <FiX className="h-4 w-4" />
                        )}
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </Card>
      </div>

      {/* AI Food Spoilage Risk Prediction Card */}
      <AIFoodSpoilageRiskCard donationId={id} donation={donation} className="w-full" />

      {/* ============ RECOMMENDED NGO MATCHES ============ */}
      <Card
        title="Recommended NGO Matches"
        icon={<FiAward className="h-5 w-5 text-[#BD715C]" />}
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={handleRetryMatches}
            loading={matchesState.loading}
            className="gap-1.5 text-xs py-1.5"
          >
            <FiRefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </Button>
        }
      >
        {/* AI availability notice */}
        {!matchesState.aiAvailable && hasRecommendations && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-800 border border-blue-200">
            <FiInfo className="h-4 w-4 text-blue-600 shrink-0" />
            <span>AI model unavailable — deterministic matching active. Results are based on capacity, distance, and category compatibility.</span>
          </div>
        )}

        {/* Location required notice */}
        {matchesState.locationRequired && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 border border-amber-200">
            <FiAlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Donation location is required for NGO matching. Please update the donation with a valid pickup location.</span>
          </div>
        )}

        {/* Loading state */}
        {matchesState.loading ? (
          <div className="py-6 flex flex-col items-center justify-center gap-2 text-xs font-medium text-slate-500">
            <Spinner size={24} />
            <span>Finding suitable NGOs...</span>
          </div>
        ) : hasRecommendations ? (
          /* Primary: Verified FoodBridge NGO recommendations */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {matchesState.recommendations.map((m, idx) => (
              <NGORecommendationCard
                key={m.ngoId || m.id || idx}
                ngo={m}
                rank={idx + 1}
                donation={{ quantity: donation.quantity, category: donation.category, unit: donation.unit }}
                onViewOnMap={handleViewOnMap}
                onViewDetails={(ngo) => setSelectedNgoModal(ngo)}
              />
            ))}
          </div>
        ) : !hasNearbyUnverified && totalFailure ? (
          /* Total failure: both services down */
          <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
            <FiAlertCircle className="h-8 w-8 text-slate-400" />
            <div className="text-sm font-semibold text-slate-600">Unable to load NGO recommendations</div>
            <p className="text-xs text-slate-500 max-w-md">Both the matching service and nearby NGO discovery are temporarily unavailable. Please try again.</p>
            <Button size="sm" onClick={handleRetryMatches} className="mt-2 gap-1.5 text-xs">
              <FiRefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        ) : !hasNearbyUnverified ? (
          /* No NGOs found at all */
          <div className="py-6 text-center text-xs font-medium text-slate-500">
            No nearby NGOs found for this donation location.
          </div>
        ) : (
          /* No verified recommendations, but nearby unverified exist — show note */
          <div className="py-4 text-center text-xs font-medium text-slate-500">
            No verified FoodBridge NGOs matched this donation. See nearby organizations below.
          </div>
        )}
      </Card>

      {/* ============ NEARBY NGOs — CAPACITY VERIFICATION NEEDED ============ */}
      {hasNearbyUnverified && (
        <Card
          title="Nearby NGOs"
          description="Real organizations found near the donation location. Capacity and food acceptance must be confirmed."
          icon={<FiMapPin className="h-5 w-5 text-amber-600" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {matchesState.nearbyUnverified.map((n, idx) => (
              <NearbyNGOCard
                key={n.id || idx}
                ngo={n}
                donationLocation={hasValidCoords ? { latitude: donLat, longitude: donLng } : null}
              />
            ))}
          </div>
        </Card>
      )}

      {/* ============ PICKUP & NGO ROUTE MAP ============ */}
      <div ref={mapRef}>
        <Card icon={<FiMapPin className="h-5 w-5" />} title="Pickup & NGO Route Map">
          <div className="overflow-hidden rounded-2xl border border-[#E6DED6]">
            <NGOMap
              pickupLocation={hasValidCoords ? {
                latitude: donLat,
                longitude: donLng,
                address: donation.pickupAddress
              } : null}
              initialNgos={allMapNgos}
              selectedNgoId={highlightedNgoId}
            />
          </div>
        </Card>
      </div>

      {/* ============ NGO DETAIL MODAL ============ */}
      <Modal
        open={Boolean(selectedNgoModal)}
        onClose={() => setSelectedNgoModal(null)}
        title={selectedNgoModal?.ngoName || selectedNgoModal?.name || 'NGO Details'}
      >
        {selectedNgoModal && (
          <div className="space-y-4 text-xs font-medium text-[#292B29]">
            <div className="flex items-center justify-between pb-2 border-b border-[#E6DED6]/60">
              <div>
                <span className="text-[10px] font-bold text-[#626760] uppercase tracking-wider block">Verification</span>
                {selectedNgoModal.verified || selectedNgoModal.source === 'FOODBRIDGE' ? (
                  <Badge variant="success"><FiShield className="inline h-3 w-3 mr-1" />Verified Partner</Badge>
                ) : (
                  <Badge variant="warning">Nearby Organization</Badge>
                )}
              </div>
              <div className="text-right">
                {(selectedNgoModal.matchScore !== undefined && selectedNgoModal.matchScore !== null) && (
                  <>
                    <span className="text-[10px] font-bold text-[#626760] uppercase tracking-wider block">Match Score</span>
                    <span className="text-base font-extrabold text-[#BD715C]">{formatMatchScore(selectedNgoModal.matchScore)}</span>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div><strong className="text-slate-500 uppercase text-[10px] block">Location / City</strong> {selectedNgoModal.city || selectedNgoModal.address || 'Local Region'}</div>
              <div><strong className="text-slate-500 uppercase text-[10px] block">Calculated Distance</strong> {selectedNgoModal.distanceKm != null ? `${selectedNgoModal.distanceKm} km` : 'N/A'}</div>

              {/* Capacity info */}
              {selectedNgoModal.capacityMatch === true && (
                <div className="flex items-center gap-2 text-emerald-700">
                  <FiCheckCircle className="h-3.5 w-3.5" />
                  <span>Capacity Compatible — Available: {selectedNgoModal.availableCapacity}, Needed: {donation.quantity}</span>
                </div>
              )}
              {selectedNgoModal.capacityMatch === false && (
                <div className="flex items-center gap-2 text-red-600">
                  <FiXCircle className="h-3.5 w-3.5" />
                  <span>Insufficient Capacity — Available: {selectedNgoModal.availableCapacity}, Needed: {donation.quantity}</span>
                </div>
              )}

              {/* Category info */}
              {selectedNgoModal.categoryMatch === true && (
                <div className="flex items-center gap-2 text-emerald-700">
                  <FiCheckCircle className="h-3.5 w-3.5" />
                  <span>Food Category Accepted</span>
                </div>
              )}
              {selectedNgoModal.categoryMatch === false && (
                <div className="flex items-center gap-2 text-red-600">
                  <FiXCircle className="h-3.5 w-3.5" />
                  <span>Food Category Not Accepted</span>
                </div>
              )}

              {/* Workload */}
              {selectedNgoModal.currentWorkload != null && (
                <div className="flex items-center gap-2 text-amber-700">
                  <FiActivity className="h-3.5 w-3.5" />
                  <span>Current Workload: {selectedNgoModal.currentWorkload} active requests</span>
                </div>
              )}

              {selectedNgoModal.phone && (
                <div className="flex items-center gap-2"><FiPhone className="h-3.5 w-3.5 text-[#BD715C]" /> <span>{selectedNgoModal.phone}</span></div>
              )}
              {selectedNgoModal.email && (
                <div className="flex items-center gap-2"><FiMail className="h-3.5 w-3.5 text-[#BD715C]" /> <span>{selectedNgoModal.email}</span></div>
              )}
            </div>

            {selectedNgoModal.factors && typeof selectedNgoModal.factors === 'object' && Object.keys(selectedNgoModal.factors).length > 0 && (
              <div className="pt-2 border-t border-[#E6DED6]/60">
                <strong className="text-[#626760] uppercase text-[10px] block mb-2">Match Factors</strong>
                <div className="grid grid-cols-3 gap-2 bg-[#FAF7F2] border border-[#E6DED6] p-3 rounded-xl text-center">
                  {selectedNgoModal.factors.distance && (
                    <div><span className="block text-[9px] uppercase text-[#626760] font-bold">Proximity</span> <span className="font-extrabold text-[#BD715C]">{selectedNgoModal.factors.distance}</span></div>
                  )}
                  {selectedNgoModal.factors.quantityCompatibility && (
                    <div><span className="block text-[9px] uppercase text-[#626760] font-bold">Capacity</span> <span className="font-extrabold text-[#BD715C]">{selectedNgoModal.factors.quantityCompatibility}</span></div>
                  )}
                  {selectedNgoModal.factors.urgency && (
                    <div><span className="block text-[9px] uppercase text-[#626760] font-bold">Urgency</span> <span className="font-extrabold text-[#BD715C]">{selectedNgoModal.factors.urgency}</span></div>
                  )}
                </div>
              </div>
            )}

            {/* Food types accepted */}
            {Array.isArray(selectedNgoModal.foodTypesAccepted) && selectedNgoModal.foodTypesAccepted.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <strong className="text-slate-500 uppercase text-[10px] block mb-2">Accepted Food Types</strong>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNgoModal.foodTypesAccepted.map((t, i) => (
                    <Badge key={i} variant="secondary">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
};

export default DonationDetails;
