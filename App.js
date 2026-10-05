import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  Dimensions,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  Animated,
  PanResponder,
  TextInput,
  ScrollView
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;
const FAVORITE_ALBUM = '相册管家-精选收藏';

// 备用演示相片（在真机相册为空或权限受限时保底提供体验）
const DEMO_PHOTOS = [
  { id: 'demo-1', uri: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80', filename: '夏日白沙滩.jpg', width: 3024, height: 4032, creationTime: Date.now() - 86400000 * 2, mediaType: 'photo' },
  { id: 'demo-2', uri: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80', filename: '星空雪山峰.jpg', width: 3840, height: 2160, creationTime: Date.now() - 86400000 * 5, mediaType: 'photo' },
  { id: 'demo-3', uri: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80', filename: '清晨雾中林.jpg', width: 2560, height: 1440, creationTime: Date.now() - 86400000 * 12, mediaType: 'photo' },
  { id: 'demo-4', uri: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80', filename: '森林阳光.jpg', width: 4000, height: 3000, creationTime: Date.now() - 86400000 * 25, mediaType: 'photo' },
  { id: 'demo-5', uri: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80', filename: '峡谷山水.jpg', width: 3840, height: 2400, creationTime: Date.now() - 86400000 * 45, mediaType: 'photo' },
  { id: 'demo-6', uri: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80', filename: 'Screenshot_20261001.jpg', width: 1080, height: 2400, creationTime: Date.now() - 86400000 * 60, mediaType: 'photo' },
  { id: 'demo-7', uri: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80', filename: '极简办公桌.jpg', width: 3000, height: 2000, creationTime: Date.now() - 86400000 * 80, mediaType: 'photo' }
];

export default function App() {
  // 全部照片池
  const [allPhotos, setAllPhotos] = useState([]);
  // 当前过滤队列（依据模式与月份过滤，且剔除已筛选照片）
  const [activeQueue, setActiveQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 清理模式: 'all' (全部) | 'month' (按月) | 'screenshot' (截图) | 'video' (视频)
  const [cleanMode, setCleanMode] = useState('all');
  const [selectedMonthKey, setSelectedMonthKey] = useState(''); // 例如 '2026年9月'

  // 待删回收箱暂存区
  const [pendingDeletions, setPendingDeletions] = useState([]);
  const [recycleModalVisible, setRecycleModalVisible] = useState(false);

  // 已筛选照片追踪集合（右滑保留、上滑收藏、下滑归档、左滑待删的照片均被记录，防止回到主界面重复审核）
  const [reviewedPhotoIds, setReviewedPhotoIds] = useState(new Set());
  const reviewedPhotoIdsRef = useRef(new Set());

  // 免打扰机制状态（记录今日免打扰生效日期，如 '2026-10-01'）
  const [silentConfirmDate, setSilentConfirmDate] = useState('');
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [pendingActionType, setPendingActionType] = useState('trash'); // 'trash' (移入相册回收站) | 'delete' (彻底删除)
  const [dontRemindChecked, setDontRemindChecked] = useState(false);

  // 月份选择抽屉弹窗
  const [monthModalVisible, setMonthModalVisible] = useState(false);

  // 相册收纳弹窗
  const [albumModalVisible, setAlbumModalVisible] = useState(false);
  const [albums, setAlbums] = useState([]);
  const [newAlbumName, setNewAlbumName] = useState('');

  // 整理历史（用于撤销）
  const [history, setHistory] = useState([]);

  // 状态与轻量 Toast
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info'); // 'info' | 'success' | 'warn'

  // 原生 Animated.ValueXY 驱动卡片位移与旋转，零延迟跟手
  const position = useRef(new Animated.ValueXY()).current;
  const isSwiping = useRef(false);
  const toastTimeoutRef = useRef(null);

  // 引用闭包保底（PanResponder 内部安全读取最新状态）
  const currentIndexRef = useRef(0);
  const activeQueueRef = useRef([]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    activeQueueRef.current = activeQueue;
  }, [activeQueue]);

  useEffect(() => {
    reviewedPhotoIdsRef.current = reviewedPhotoIds;
  }, [reviewedPhotoIds]);

  // 显示顶部轻量通知
  const showToast = (msg, type = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    setToastType(type);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage('');
    }, 2800);
  };

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    setLoading(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(false);
      if (perm.status === 'granted') {
        await loadMediaLibrary();
      } else {
        setAllPhotos(DEMO_PHOTOS);
        showToast('⚠️ 未获得相册权限，已加载精选演示照片', 'warn');
      }
    } catch (e) {
      console.log('权限初始化异常:', e);
      setAllPhotos(DEMO_PHOTOS);
    } finally {
      setLoading(false);
    }
  };

  // 全面拉取系统照片与视频
  const loadMediaLibrary = async () => {
    try {
      setLoading(true);
      let mediaItems = [];

      // 1. 读取系统照片与视频 (最多拉取 1000 项)
      try {
        const assets = await MediaLibrary.getAssetsAsync({
          first: 1000,
          mediaType: ['photo', 'video'],
          sortBy: [[MediaLibrary.SortBy.creationTime, false]]
        });
        if (assets && assets.assets && assets.assets.length > 0) {
          mediaItems = assets.assets;
        }
      } catch (err) {
        console.log('主要相册拉取失败，尝试相册遍历兜底:', err);
      }

      // 2. 遍历各子相册（Camera, DCIM, Pictures）兜底
      if (mediaItems.length === 0) {
        try {
          const userAlbums = await MediaLibrary.getAlbumsAsync();
          for (const alb of userAlbums) {
            if (alb.assetCount > 0) {
              const albAssets = await MediaLibrary.getAssetsAsync({
                album: alb,
                first: 100,
                mediaType: ['photo', 'video']
              });
              if (albAssets?.assets?.length > 0) {
                mediaItems = [...mediaItems, ...albAssets.assets];
              }
            }
          }
        } catch (err2) {
          console.log('相册遍历异常:', err2);
        }
      }

      if (mediaItems.length === 0) {
        mediaItems = DEMO_PHOTOS;
        showToast('相册为空，已载入演示相片 📱', 'info');
      }

      setAllPhotos(mediaItems);
      await loadAlbums();
      showToast(`已加载 ${mediaItems.length} 项相册文件 📱`, 'success');
    } catch (e) {
      console.log('媒体读取错误:', e);
      setAllPhotos(DEMO_PHOTOS);
    } finally {
      setLoading(false);
    }
  };

  // 读取系统所有相册
  const loadAlbums = async () => {
    try {
      const userAlbums = await MediaLibrary.getAlbumsAsync();
      setAlbums(userAlbums || []);
    } catch (e) {
      console.log('读取相册列表错误:', e);
    }
  };

  // 计算月份时间胶囊聚合列表
  const monthGroups = useMemo(() => {
    const groups = {};
    allPhotos.forEach(p => {
      const t = p.creationTime ? new Date(p.creationTime) : new Date();
      const key = `${t.getFullYear()}年${t.getMonth() + 1}月`;
      if (!groups[key]) {
        groups[key] = { key, count: 0, photos: [] };
      }
      groups[key].count += 1;
      groups[key].photos.push(p);
    });
    return Object.values(groups);
  }, [allPhotos]);

  // 根据当前选择的模式与已审阅排重集合更新 activeQueue
  useEffect(() => {
    let filtered = [];
    if (cleanMode === 'all') {
      filtered = allPhotos;
    } else if (cleanMode === 'month') {
      const found = monthGroups.find(g => g.key === selectedMonthKey);
      filtered = found ? found.photos : allPhotos;
    } else if (cleanMode === 'screenshot') {
      // 截图筛选
      filtered = allPhotos.filter(p => {
        const name = (p.filename || '').toLowerCase();
        return name.includes('screenshot') || name.includes('截屏') || name.includes('截图');
      });
      if (filtered.length === 0) {
        showToast('未检测到屏幕截图，显示全部照片', 'info');
        filtered = allPhotos;
      }
    } else if (cleanMode === 'video') {
      // 视频筛选
      filtered = allPhotos.filter(p => p.mediaType === 'video' || (p.filename || '').endsWith('.mp4'));
      if (filtered.length === 0) {
        showToast('相册中未发现视频，显示全部照片', 'info');
        filtered = allPhotos;
      }
    }

    // 核心排重机制：过滤掉所有已经审阅过的相片（保留、收藏、归档、待删）
    const unreviewed = filtered.filter(p => !reviewedPhotoIds.has(p.id));

    setActiveQueue(unreviewed);
    setCurrentIndex(0);
    setHistory([]);
  }, [allPhotos, cleanMode, selectedMonthKey, monthGroups, reviewedPhotoIds]);

  // 触觉反馈
  const triggerHaptic = (action) => {
    try {
      if (action === 'delete') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {}
  };

  // 格式化日期展示
  const formatPhotoDate = (timestamp) => {
    if (!timestamp) return '近期拍摄';
    const d = new Date(timestamp);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  };

  // 执行核心动作（标记已审阅并显式传递 targetPhoto 彻底杜绝卡片错位）
  const handleAction = async (action, targetPhoto = null, targetAlbum = null) => {
    const idx = currentIndexRef.current;
    const currentPhoto = targetPhoto || activeQueueRef.current[idx];
    if (!currentPhoto) return;

    triggerHaptic(action);

    // 核心记录：将当前照片 ID 记入已审阅集合，确保后续不再重复展示
    setReviewedPhotoIds(prev => new Set(prev).add(currentPhoto.id));

    // 记录历史供撤销
    setHistory(prev => [...prev, { photo: currentPhoto, action, album: targetAlbum, index: idx }]);

    // 1. 左滑：加入待删除回收箱
    if (action === 'delete') {
      setPendingDeletions(prev => {
        if (!prev.some(p => p.id === currentPhoto.id)) {
          return [...prev, currentPhoto];
        }
        return prev;
      });
      showToast('🗑 已放入待删回收箱 (可随时撤回)', 'warn');
    }

    // 2. 上滑：真实收藏（写入系统相册）
    else if (action === 'like') {
      if (!String(currentPhoto.id).startsWith('demo-')) {
        try {
          let favAlbum = await MediaLibrary.getAlbumAsync(FAVORITE_ALBUM);
          if (!favAlbum) {
            favAlbum = await MediaLibrary.createAlbumAsync(FAVORITE_ALBUM, currentPhoto.id || currentPhoto, false);
            await loadAlbums();
          } else {
            await MediaLibrary.addAssetsToAlbumAsync([currentPhoto.id || currentPhoto], favAlbum, false);
          }
          showToast(`❤️ 已收藏收录至系统相册【${FAVORITE_ALBUM}】`, 'success');
        } catch (likeErr) {
          try {
            let favAlbum = await MediaLibrary.getAlbumAsync(FAVORITE_ALBUM);
            if (favAlbum) {
              await MediaLibrary.addAssetsToAlbumAsync([currentPhoto.id || currentPhoto], favAlbum, true);
              showToast(`❤️ 已收藏至系统相册【${FAVORITE_ALBUM}】`, 'success');
            }
          } catch (e2) {
            showToast('⚠️ 收藏写入失败，请检查写入权限', 'warn');
          }
        }
      } else {
        showToast('❤️ [演示] 已加入精选收藏相册', 'success');
      }
    }

    // 3. 下滑：真实归档到指定相册
    else if (action === 'album' && targetAlbum) {
      if (!String(currentPhoto.id).startsWith('demo-')) {
        try {
          let albumObj = targetAlbum;
          if (typeof targetAlbum === 'string') {
            albumObj = await MediaLibrary.getAlbumAsync(targetAlbum);
            if (!albumObj) {
              albumObj = await MediaLibrary.createAlbumAsync(targetAlbum, currentPhoto.id || currentPhoto, false);
            }
          }
          await MediaLibrary.addAssetsToAlbumAsync([currentPhoto.id || currentPhoto], albumObj, false);
          await loadAlbums();
          const albName = albumObj?.title || targetAlbum;
          showToast(`📁 已真正移入系统相册【${albName}】`, 'success');
        } catch (albErr) {
          try {
            let albumObj = targetAlbum;
            if (typeof targetAlbum === 'string') {
              albumObj = await MediaLibrary.getAlbumAsync(targetAlbum);
            }
            if (albumObj) {
              await MediaLibrary.addAssetsToAlbumAsync([currentPhoto.id || currentPhoto], albumObj, true);
              const albName = albumObj?.title || targetAlbum;
              showToast(`📁 已收纳进系统相册【${albName}】`, 'success');
            }
          } catch (e3) {
            showToast('⚠️ 归档失败，请检查相册权限', 'warn');
          }
        }
      } else {
        showToast(`📁 [演示] 已归档至「${targetAlbum?.title || targetAlbum}」`, 'success');
      }
    }

    // 4. 右滑：保留在相册
    else if (action === 'keep') {
      showToast('✨ 已保留在相册', 'info');
    }

    // 递增索引进入下一张卡片
    setCurrentIndex(prev => prev + 1);
  };

  // 卡片划走动画
  const swipeCard = (targetX, targetY, action, targetPhoto = null, targetAlbum = null) => {
    if (isSwiping.current) return;
    isSwiping.current = true;

    Animated.timing(position, {
      toValue: { x: targetX, y: targetY },
      duration: 180,
      useNativeDriver: false
    }).start(() => {
      handleAction(action, targetPhoto, targetAlbum);
      position.setValue({ x: 0, y: 0 });
      isSwiping.current = false;
    });
  };

  // 弹簧回弹复位
  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 6,
      tension: 45,
      useNativeDriver: false
    }).start();
  };

  // 撤销上一步（Undo，同时从已审阅集合中恢复）
  const handleUndo = () => {
    if (history.length === 0 || currentIndex === 0) {
      showToast('当前没有可撤销的操作 🐱', 'info');
      return;
    }
    const lastOp = history[history.length - 1];

    // 从已审阅集合中移除该照片，恢复其未审阅状态
    setReviewedPhotoIds(prev => {
      const nextSet = new Set(prev);
      nextSet.delete(lastOp.photo.id);
      return nextSet;
    });

    // 若上一张是放入待删箱，则将其从待删箱移出
    if (lastOp.action === 'delete') {
      setPendingDeletions(prev => prev.filter(p => p.id !== lastOp.photo.id));
    }

    setHistory(prev => prev.slice(0, -1));
    setCurrentIndex(prev => Math.max(0, prev - 1));
    position.setValue({ x: 0, y: 0 });
    showToast('↩️ 已撤回上一张照片', 'info');
  };

  // 获取今天的统一日期字符串（用于今日不再提醒判定）
  const getTodayString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  // 点击待删回收箱按钮时的前置拦截判定（支持今日不再提醒免打扰）
  const requestActionWithConfirm = (actionType) => {
    if (pendingDeletions.length === 0) return;

    const todayStr = getTodayString();
    // 如果今天已设置免打扰，直接执行，不再弹窗打扰
    if (silentConfirmDate === todayStr) {
      executeBatchOperation(actionType);
      return;
    }

    // 否则弹出自定义确认对话框，并提供「今日不再提醒」勾选选项
    setPendingActionType(actionType);
    setDontRemindChecked(false);
    setConfirmModalVisible(true);
  };

  // 在确认弹窗中点击【允许】
  const handleConfirmModalAllow = () => {
    const todayStr = getTodayString();
    if (dontRemindChecked) {
      setSilentConfirmDate(todayStr);
    }
    setConfirmModalVisible(false);
    executeBatchOperation(pendingActionType);
  };

  // 执行真实的批量操作：'trash' (移入相册回收站) 或 'delete' (彻底删除)
  const executeBatchOperation = async (actionType) => {
    if (pendingDeletions.length === 0) return;

    const realAssets = pendingDeletions.filter(p => !String(p.id).startsWith('demo-'));

    // 演示照片兜底
    if (realAssets.length === 0) {
      const count = pendingDeletions.length;
      const deletedIdSet = new Set(pendingDeletions.map(p => p.id));
      setAllPhotos(prev => prev.filter(p => !deletedIdSet.has(p.id)));
      setPendingDeletions([]);
      setRecycleModalVisible(false);
      showToast(actionType === 'trash' ? `📦 [演示] 已移入相册回收站 (${count}张)` : `🎉 [演示] 已彻底删除 (${count}张)`, 'success');
      return;
    }

    try {
      setLoading(true);
      const idsToDelete = realAssets.map(p => p.id || p);

      // 调用系统底层安全删除接口（在 Android 11+ 上默认安全移入系统相册回收站，并提供永久释放支持）
      const isSuccess = await MediaLibrary.deleteAssetsAsync(idsToDelete);
      if (isSuccess) {
        const deletedIdSet = new Set(pendingDeletions.map(p => p.id));
        setAllPhotos(prev => prev.filter(p => !deletedIdSet.has(p.id)));
        setPendingDeletions([]);
        setRecycleModalVisible(false);

        if (actionType === 'trash') {
          showToast(`📦 成功将 ${realAssets.length} 张照片移入相册回收站！`, 'success');
        } else {
          showToast(`🎉 成功彻底删除 ${realAssets.length} 张照片，释放存储空间！`, 'success');
        }
      } else {
        showToast('⚠️ 未确认授权删除', 'info');
      }
    } catch (err) {
      console.log('批量操作异常:', err);
      showToast('⚠️ 操作已取消或未完成', 'warn');
    } finally {
      setLoading(false);
    }
  };

  // 从待删箱移出单张照片
  const handleRemoveFromTrash = (photoId) => {
    setPendingDeletions(prev => prev.filter(p => p.id !== photoId));
    // 从已审阅集合中移出，使其可以在主队列重新出现
    setReviewedPhotoIds(prev => {
      const nextSet = new Set(prev);
      nextSet.delete(photoId);
      return nextSet;
    });
    showToast('已从待删箱恢复', 'info');
  };

  // 新建相册并归档
  const handleCreateAndArchive = async () => {
    const trimmed = newAlbumName.trim();
    if (!trimmed) {
      Alert.alert('提示', '请输入新相册名称');
      return;
    }
    const currentPhoto = activeQueueRef.current[currentIndexRef.current];
    setAlbumModalVisible(false);
    setNewAlbumName('');
    swipeCard(0, SCREEN_HEIGHT, 'album', currentPhoto, trimmed);
  };

  // 原生独占手势监听
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        position.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (e, gestureState) => {
        if (isSwiping.current) return;
        position.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isSwiping.current) return;
        const currentPhoto = activeQueueRef.current[currentIndexRef.current];
        const { dx, dy } = gestureState;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (absY > absX && absY > SWIPE_THRESHOLD) {
          if (dy < -SWIPE_THRESHOLD) {
            // ⬆ 上滑：收藏精选
            swipeCard(0, -SCREEN_HEIGHT * 1.2, 'like', currentPhoto);
          } else {
            // ⬇ 下滑：收纳到相册
            resetPosition();
            setAlbumModalVisible(true);
          }
        } else if (absX > SWIPE_THRESHOLD) {
          if (dx < -SWIPE_THRESHOLD) {
            // ⬅ 左滑：待删箱
            swipeCard(-SCREEN_WIDTH * 1.5, 0, 'delete', currentPhoto);
          } else {
            // ➡ 右滑：保留在相册
            swipeCard(SCREEN_WIDTH * 1.5, 0, 'keep', currentPhoto);
          }
        } else {
          resetPosition();
        }
      },
      onPanResponderTerminate: () => {
        resetPosition();
      }
    })
  ).current;

  // 顶层卡片微倾角旋转
  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
    outputRange: ['-22deg', '0deg', '22deg'],
    extrapolate: 'clamp'
  });

  const topCardStyle = {
    zIndex: 10,
    elevation: 10,
    transform: [
      ...position.getTranslateTransform(),
      { rotate }
    ]
  };

  // 底层卡片平滑层叠
  const bottomCardScale = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD * 2, 0, SWIPE_THRESHOLD * 2],
    outputRange: [1, 0.95, 1],
    extrapolate: 'clamp'
  });
  const bottomCardOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD * 2, 0, SWIPE_THRESHOLD * 2],
    outputRange: [1, 0.88, 1],
    extrapolate: 'clamp'
  });

  // 四向徽章透明度插值
  const likeBadgeOpacity = position.y.interpolate({
    inputRange: [-100, -25, 0],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp'
  });
  const albumBadgeOpacity = position.y.interpolate({
    inputRange: [0, 25, 100],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp'
  });
  const deleteBadgeOpacity = position.x.interpolate({
    inputRange: [-100, -25, 0],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp'
  });
  const keepBadgeOpacity = position.x.interpolate({
    inputRange: [0, 25, 100],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp'
  });

  const currentPhoto = activeQueue[currentIndex];
  const nextPhoto = currentIndex + 1 < activeQueue.length ? activeQueue[currentIndex + 1] : null;
  const isCompleted = activeQueue.length > 0 && currentIndex >= activeQueue.length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F7F5" />

      {/* 顶部主导航栏 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.brandIcon}>
            <Text style={styles.brandEmoji}>📱</Text>
          </View>
          <View>
            <View style={styles.brandRow}>
              <Text style={styles.brandTitle}>相册管家</Text>
              <View style={styles.brandTag}>
                <Text style={styles.brandTagText}>Photomanager</Text>
              </View>
            </View>
            <Text style={styles.brandSubtitle}>滑动整理 · 高效相册管家</Text>
          </View>
        </View>

        {/* 右侧：待删回收箱与计数 */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.trashBadge, pendingDeletions.length > 0 && styles.trashBadgeActive]}
            onPress={() => setRecycleModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.trashBadgeText}>🗑 {pendingDeletions.length}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.refreshIconBtn} onPress={loadMediaLibrary} activeOpacity={0.7}>
            <Text style={styles.refreshIconText}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 清理模式快捷选项卡 */}
      <View style={styles.modeTabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeTabsContent}>
          <TouchableOpacity
            style={[styles.modeTab, cleanMode === 'all' && styles.modeTabActive]}
            onPress={() => setCleanMode('all')}
          >
            <Text style={[styles.modeTabText, cleanMode === 'all' && styles.modeTabTextActive]}>🌟 全部照片</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, cleanMode === 'month' && styles.modeTabActive]}
            onPress={() => setMonthModalVisible(true)}
          >
            <Text style={[styles.modeTabText, cleanMode === 'month' && styles.modeTabTextActive]}>
              📅 {selectedMonthKey || '按月整理'} ▾
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, cleanMode === 'screenshot' && styles.modeTabActive]}
            onPress={() => setCleanMode('screenshot')}
          >
            <Text style={[styles.modeTabText, cleanMode === 'screenshot' && styles.modeTabTextActive]}>📸 截图专区</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, cleanMode === 'video' && styles.modeTabActive]}
            onPress={() => setCleanMode('video')}
          >
            <Text style={[styles.modeTabText, cleanMode === 'video' && styles.modeTabTextActive]}>🎥 视频瘦身</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 进度条指示器 */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: activeQueue.length > 0 ? `${Math.min(100, (currentIndex / activeQueue.length) * 100)}%` : '0%' }
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {activeQueue.length > 0 ? `${currentIndex} / ${activeQueue.length}` : '0 / 0'}
        </Text>
      </View>

      {/* 悬浮操作提示 Toast */}
      {toastMessage !== '' && (
        <View style={[
          styles.toastContainer,
          toastType === 'warn' ? styles.toastWarn : toastType === 'success' ? styles.toastSuccess : styles.toastInfo
        ]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* 卡片工作区 */}
      <View style={styles.cardArea}>
        {loading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.emptyTip}>正在整理相册...</Text>
          </View>
        ) : isCompleted ? (
          /* 当前阶段全部整理完成卡片 */
          <View style={styles.completedCard}>
            <Text style={styles.completedEmoji}>🎉</Text>
            <Text style={styles.completedTitle}>当前相册已整理完毕！</Text>
            <Text style={styles.completedSubtitle}>
              已为您剔除全部已审阅照片，待删箱暂存了 {pendingDeletions.length} 张照片
            </Text>

            {pendingDeletions.length > 0 && (
              <TouchableOpacity
                style={styles.oneClickDeleteBtn}
                onPress={() => setRecycleModalVisible(true)}
              >
                <Text style={styles.oneClickDeleteBtnText}>🚀 前往待删箱批量处理</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.switchOtherMonthBtn}
              onPress={() => setMonthModalVisible(true)}
            >
              <Text style={styles.switchOtherMonthBtnText}>📅 切换其他月份继续整理</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.restartBtn}
              onPress={() => {
                // 重置当前分类已审阅记录，重新开始温习
                setReviewedPhotoIds(new Set());
                setCurrentIndex(0);
                setHistory([]);
              }}
            >
              <Text style={styles.restartBtnText}>↺ 重新温习本组照片</Text>
            </TouchableOpacity>
          </View>
        ) : currentPhoto ? (
          <View style={styles.deckContainer}>
            {/* 底层备用卡片 */}
            {nextPhoto && (
              <Animated.View
                style={[
                  styles.card,
                  styles.bottomCard,
                  {
                    transform: [{ scale: bottomCardScale }],
                    opacity: bottomCardOpacity
                  }
                ]}
                pointerEvents="none"
              >
                <Image source={{ uri: nextPhoto.uri }} style={styles.cardImage} resizeMode="cover" />
                <View style={styles.cardInfoFooter}>
                  <Text style={styles.cardDateText}>{formatPhotoDate(nextPhoto.creationTime)}</Text>
                  <Text style={styles.cardDimText}>下一张准备就绪</Text>
                </View>
              </Animated.View>
            )}

            {/* 顶层活动卡片 */}
            <Animated.View
              style={[styles.card, topCardStyle]}
              {...panResponder.panHandlers}
            >
              <Image
                source={{ uri: currentPhoto.uri }}
                style={styles.cardImage}
                resizeMode="cover"
                pointerEvents="none"
              />

              {/* 四个方向半透明浮层徽章 */}
              <Animated.View style={[styles.badge, styles.likeBadge, { opacity: likeBadgeOpacity }]} pointerEvents="none">
                <Text style={styles.badgeText}>❤️ 收藏精选</Text>
              </Animated.View>

              <Animated.View style={[styles.badge, styles.albumBadge, { opacity: albumBadgeOpacity }]} pointerEvents="none">
                <Text style={styles.badgeText}>📁 归档相册</Text>
              </Animated.View>

              <Animated.View style={[styles.badge, styles.deleteBadge, { opacity: deleteBadgeOpacity }]} pointerEvents="none">
                <Text style={styles.badgeText}>🗑 移入待删</Text>
              </Animated.View>

              <Animated.View style={[styles.badge, styles.keepBadge, { opacity: keepBadgeOpacity }]} pointerEvents="none">
                <Text style={styles.badgeText}>✨ 留在相册</Text>
              </Animated.View>

              {/* 照片底部元数据条 */}
              <View style={styles.cardInfoFooter} pointerEvents="none">
                <View>
                  <Text style={styles.cardDateText}>{formatPhotoDate(currentPhoto.creationTime)}</Text>
                  <Text style={styles.cardDimText}>
                    {currentPhoto.filename ? currentPhoto.filename.slice(-18) : '照片'} · {currentPhoto.width && currentPhoto.height ? `${currentPhoto.width}×${currentPhoto.height}` : 'HD'}
                  </Text>
                </View>
                <View style={styles.gestureIndicatorPill}>
                  <Text style={styles.gestureIndicatorText}>可四向滑动 👆</Text>
                </View>
              </View>
            </Animated.View>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📱</Text>
            <Text style={styles.emptyTip}>当前分类没有未整理的照片哦</Text>
          </View>
        )}
      </View>

      {/* 底部 5 大核心操作按钮 */}
      <View style={styles.actionToolbar}>
        {/* 撤销 (Undo) */}
        <TouchableOpacity
          style={[styles.toolBtn, styles.undoBtn, history.length === 0 && styles.btnDisabled]}
          onPress={handleUndo}
          activeOpacity={0.7}
          disabled={history.length === 0}
        >
          <Text style={styles.toolBtnEmoji}>↩️</Text>
          <Text style={styles.toolBtnLabel}>撤销</Text>
        </TouchableOpacity>

        {/* 左滑删除 */}
        <TouchableOpacity
          style={[styles.toolBtn, styles.deleteBtn]}
          onPress={() => swipeCard(-SCREEN_WIDTH * 1.5, 0, 'delete', currentPhoto)}
          activeOpacity={0.7}
        >
          <Text style={styles.toolBtnEmoji}>🗑</Text>
          <Text style={styles.toolBtnLabel}>待删</Text>
        </TouchableOpacity>

        {/* 下滑归档 */}
        <TouchableOpacity
          style={[styles.toolBtn, styles.albumBtn]}
          onPress={() => setAlbumModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.toolBtnEmoji}>📁</Text>
          <Text style={styles.toolBtnLabel}>归档</Text>
        </TouchableOpacity>

        {/* 右滑保留 */}
        <TouchableOpacity
          style={[styles.toolBtn, styles.keepBtn]}
          onPress={() => swipeCard(SCREEN_WIDTH * 1.5, 0, 'keep', currentPhoto)}
          activeOpacity={0.7}
        >
          <Text style={styles.toolBtnEmoji}>✨</Text>
          <Text style={styles.toolBtnLabel}>保留</Text>
        </TouchableOpacity>

        {/* 上滑收藏 */}
        <TouchableOpacity
          style={[styles.toolBtn, styles.likeBtn]}
          onPress={() => swipeCard(0, -SCREEN_HEIGHT * 1.2, 'like', currentPhoto)}
          activeOpacity={0.7}
        >
          <Text style={styles.toolBtnEmoji}>❤️</Text>
          <Text style={styles.toolBtnLabel}>喜欢</Text>
        </TouchableOpacity>
      </View>

      {/* 弹窗 1：待删除回收箱审阅弹窗 (包含【移入相册回收站】与【彻底删除】两个明确选项) */}
      <Modal
        visible={recycleModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setRecycleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.recycleModalContent}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeaderTitle}>待删回收箱</Text>
                <Text style={styles.modalHeaderSub}>
                  已标记 {pendingDeletions.length} 张照片 · 预估可释放约 {(pendingDeletions.length * 3.2).toFixed(1)} MB 空间
                </Text>
              </View>
              <TouchableOpacity onPress={() => setRecycleModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {pendingDeletions.length === 0 ? (
              <View style={styles.recycleEmptyBox}>
                <Text style={styles.recycleEmptyEmoji}>🌱</Text>
                <Text style={styles.recycleEmptyText}>回收箱是空的，滑动时左滑即可暂存到这里</Text>
              </View>
            ) : (
              <FlatList
                data={pendingDeletions}
                keyExtractor={(item, index) => item.id || String(index)}
                numColumns={3}
                style={styles.recycleGrid}
                renderItem={({ item }) => (
                  <View style={styles.recycleGridItem}>
                    <Image source={{ uri: item.uri }} style={styles.recycleThumb} />
                    <TouchableOpacity
                      style={styles.restoreItemBadge}
                      onPress={() => handleRemoveFromTrash(item.id)}
                    >
                      <Text style={styles.restoreItemBadgeText}>恢复</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}

            {pendingDeletions.length > 0 && (
              <View style={styles.recycleFooter}>
                {/* 选项一：【移入相册回收站】 */}
                <TouchableOpacity
                  style={styles.moveToTrashAlbumBtn}
                  onPress={() => requestActionWithConfirm('trash')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.moveToTrashAlbumBtnText}>
                    📥 移入相册回收站
                  </Text>
                  <Text style={styles.btnSubInfoText}>
                    安全移入系统相册回收站，随时可撤销找回
                  </Text>
                </TouchableOpacity>

                {/* 选项二：【彻底删除】 */}
                <TouchableOpacity
                  style={styles.clearAllBtn}
                  onPress={() => requestActionWithConfirm('delete')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.clearAllBtnText}>
                    🔥 彻底删除
                  </Text>
                  <Text style={styles.btnSubInfoTextDanger}>
                    永久粉碎删除，彻底释放设备存储空间
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* 弹窗 2：是否允许修改的确认弹窗（内置“今日不再提醒”免打扰选项） */}
      <Modal
        visible={confirmModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmDialogBox}>
            <View style={styles.confirmDialogHeader}>
              <Text style={styles.confirmDialogIcon}>
                {pendingActionType === 'trash' ? '📥' : '⚠️'}
              </Text>
              <Text style={styles.confirmDialogTitle}>
                {pendingActionType === 'trash' ? '确认移入相册回收站' : '确认彻底删除'}
              </Text>
            </View>

            <Text style={styles.confirmDialogBody}>
              {pendingActionType === 'trash'
                ? `确定将待删箱中的 ${pendingDeletions.length} 张照片移入手机系统相册回收站吗？（可在系统相册回收站中随时还原）`
                : `确定彻底删除待删箱中的 ${pendingDeletions.length} 张照片吗？此操作将永久抹除并释放设备存储空间。`}
            </Text>

            {/* 今日不再提醒复选框 */}
            <TouchableOpacity
              style={styles.dontRemindRow}
              onPress={() => setDontRemindChecked(prev => !prev)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkboxBox, dontRemindChecked && styles.checkboxBoxChecked]}>
                {dontRemindChecked && <Text style={styles.checkboxCheckmark}>✓</Text>}
              </View>
              <Text style={styles.dontRemindLabel}>今日不再提醒（今天内执行此操作直接处理）</Text>
            </TouchableOpacity>

            {/* 对话框操作按钮 */}
            <View style={styles.confirmDialogActions}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setConfirmModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmCancelBtnText}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmAllowBtn,
                  pendingActionType === 'delete' ? styles.confirmAllowBtnDanger : styles.confirmAllowBtnPrimary
                ]}
                onPress={handleConfirmModalAllow}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmAllowBtnText}>允许执行</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 弹窗 3：月份时间线选择抽屉 */}
      <Modal
        visible={monthModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMonthModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.monthModalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>选择整理月份</Text>
              <TouchableOpacity onPress={() => setMonthModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={monthGroups}
              keyExtractor={item => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.monthOptionRow,
                    selectedMonthKey === item.key && styles.monthOptionRowActive
                  ]}
                  onPress={() => {
                    setSelectedMonthKey(item.key);
                    setCleanMode('month');
                    setMonthModalVisible(false);
                    showToast(`已切换至【${item.key}】整理队列`, 'success');
                  }}
                >
                  <View style={styles.monthOptionLeft}>
                    <Text style={styles.monthCalendarEmoji}>📅</Text>
                    <Text style={styles.monthOptionTitle}>{item.key}</Text>
                  </View>
                  <View style={styles.monthCountBadge}>
                    <Text style={styles.monthCountBadgeText}>{item.count} 张</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* 弹窗 4：收纳相册抽屉 */}
      <Modal
        visible={albumModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAlbumModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.albumModalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>收纳归档到系统相册</Text>
              <TouchableOpacity onPress={() => setAlbumModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 新建相册输入框 */}
            <View style={styles.newAlbumBox}>
              <TextInput
                style={styles.newAlbumInput}
                placeholder="新建相册名称 (如: 旅行/美食/工作)"
                placeholderTextColor="#94A3B8"
                value={newAlbumName}
                onChangeText={setNewAlbumName}
              />
              <TouchableOpacity style={styles.newAlbumBtn} onPress={handleCreateAndArchive}>
                <Text style={styles.newAlbumBtnText}>新建并归档</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>或选择现有系统相册：</Text>

            <FlatList
              data={albums}
              keyExtractor={(item, index) => item.id || String(index)}
              style={{ maxHeight: 240 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.albumItem}
                  onPress={() => {
                    const currentPhoto = activeQueueRef.current[currentIndexRef.current];
                    setAlbumModalVisible(false);
                    swipeCard(0, SCREEN_HEIGHT, 'album', currentPhoto, item);
                  }}
                >
                  <Text style={styles.albumItemEmoji}>📁</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.albumItemName}>{item.title}</Text>
                    <Text style={styles.albumItemCount}>{item.assetCount || 0} 项</Text>
                  </View>
                  <Text style={styles.albumItemArrow}>›</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F5'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  brandEmoji: {
    fontSize: 22
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#064E3B'
  },
  brandTag: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: '#E6FFFA',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#34D399'
  },
  brandTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669'
  },
  brandSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  trashBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 20,
    marginRight: 8
  },
  trashBadgeActive: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5'
  },
  trashBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155'
  },
  refreshIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  refreshIconText: {
    fontSize: 16
  },
  modeTabsWrapper: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC'
  },
  modeTabsContent: {
    paddingHorizontal: 16,
    alignItems: 'center'
  },
  modeTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  modeTabActive: {
    backgroundColor: '#059669',
    borderColor: '#059669'
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B'
  },
  modeTabTextActive: {
    color: '#FFFFFF'
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 10
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B'
  },
  toastContainer: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 6
  },
  toastInfo: {
    backgroundColor: '#334155'
  },
  toastSuccess: {
    backgroundColor: '#059669'
  },
  toastWarn: {
    backgroundColor: '#D97706'
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600'
  },
  cardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  deckContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  card: {
    width: SCREEN_WIDTH - 32,
    height: '96%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4
  },
  bottomCard: {
    zIndex: 1,
    elevation: 1
  },
  cardImage: {
    width: '100%',
    height: '100%'
  },
  cardInfoFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  cardDateText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700'
  },
  cardDimText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginTop: 2
  },
  gestureIndicatorPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  gestureIndicatorText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600'
  },
  badge: {
    position: 'absolute',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 2,
    zIndex: 20
  },
  likeBadge: {
    top: 24,
    alignSelf: 'center',
    borderColor: '#EC4899',
    backgroundColor: 'rgba(236, 72, 153, 0.85)'
  },
  albumBadge: {
    bottom: 80,
    alignSelf: 'center',
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.85)'
  },
  deleteBadge: {
    top: 50,
    right: 24,
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    transform: [{ rotate: '15deg' }]
  },
  keepBadge: {
    top: 50,
    left: 24,
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.85)',
    transform: [{ rotate: '-15deg' }]
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800'
  },
  actionToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  toolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  toolBtnEmoji: {
    fontSize: 20
  },
  toolBtnLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 1
  },
  btnDisabled: {
    opacity: 0.35
  },
  undoBtn: {
    borderColor: '#CBD5E1'
  },
  deleteBtn: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF1F2'
  },
  albumBtn: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF'
  },
  keepBtn: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5'
  },
  likeBtn: {
    borderColor: '#FBCFE8',
    backgroundColor: '#FDF2F8'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12
  },
  emptyTip: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8
  },
  completedCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3
  },
  completedEmoji: {
    fontSize: 44,
    marginBottom: 10
  },
  completedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#064E3B',
    marginBottom: 6
  },
  completedSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18
  },
  oneClickDeleteBtn: {
    width: '100%',
    paddingVertical: 14,
    backgroundColor: '#EF4444',
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10
  },
  oneClickDeleteBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700'
  },
  switchOtherMonthBtn: {
    width: '100%',
    paddingVertical: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10
  },
  switchOtherMonthBtnText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600'
  },
  restartBtn: {
    paddingVertical: 8
  },
  restartBtnText: {
    color: '#64748B',
    fontSize: 13
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  recycleModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.82,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B'
  },
  modalHeaderSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  modalCloseText: {
    fontSize: 20,
    color: '#94A3B8',
    padding: 6
  },
  recycleEmptyBox: {
    paddingVertical: 40,
    alignItems: 'center'
  },
  recycleEmptyEmoji: {
    fontSize: 36,
    marginBottom: 8
  },
  recycleEmptyText: {
    color: '#94A3B8',
    fontSize: 13
  },
  recycleGrid: {
    marginTop: 10,
    maxHeight: SCREEN_HEIGHT * 0.45
  },
  recycleGridItem: {
    flex: 1 / 3,
    aspectRatio: 1,
    margin: 4,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative'
  },
  recycleThumb: {
    width: '100%',
    height: '100%'
  },
  restoreItemBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  restoreItemBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700'
  },
  recycleFooter: {
    marginTop: 14,
    gap: 10
  },
  moveToTrashAlbumBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2
  },
  moveToTrashAlbumBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700'
  },
  clearAllBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2
  },
  clearAllBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700'
  },
  btnSubInfoText: {
    color: '#E0F2FE',
    fontSize: 11,
    marginTop: 2
  },
  btnSubInfoTextDanger: {
    color: '#FEE2E2',
    fontSize: 11,
    marginTop: 2
  },
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  confirmDialogBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8
  },
  confirmDialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  confirmDialogIcon: {
    fontSize: 24,
    marginRight: 8
  },
  confirmDialogTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B'
  },
  confirmDialogBody: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 16
  },
  dontRemindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#94A3B8',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF'
  },
  checkboxBoxChecked: {
    backgroundColor: '#059669',
    borderColor: '#059669'
  },
  checkboxCheckmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },
  dontRemindLabel: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
    flex: 1
  },
  confirmDialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12
  },
  confirmCancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9'
  },
  confirmCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569'
  },
  confirmAllowBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10
  },
  confirmAllowBtnPrimary: {
    backgroundColor: '#3B82F6'
  },
  confirmAllowBtnDanger: {
    backgroundColor: '#EF4444'
  },
  confirmAllowBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  monthModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.65,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  monthOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  monthOptionRowActive: {
    backgroundColor: '#ECFDF5',
    borderRadius: 10
  },
  monthOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  monthCalendarEmoji: {
    fontSize: 18,
    marginRight: 10
  },
  monthOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B'
  },
  monthCountBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12
  },
  monthCountBadgeText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600'
  },
  albumModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.75,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  newAlbumBox: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 16
  },
  newAlbumInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1E293B',
    marginRight: 8
  },
  newAlbumBtn: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center'
  },
  newAlbumBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8
  },
  albumItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  albumItemEmoji: {
    fontSize: 20,
    marginRight: 10
  },
  albumItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B'
  },
  albumItemCount: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2
  },
  albumItemArrow: {
    fontSize: 18,
    color: '#CBD5E1'
  }
});
