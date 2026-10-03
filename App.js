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
const FAVORITE_ALBUM = 'PhotoSwipe-精选喜欢';
const TRASH_ALBUM = '🗑️PhotoSwipe-相册回收站';

// 备用精选演示相片（在真机相册为空或权限受限时保底提供丝滑体验）
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
  // 当前过滤队列（依据模式与月份过滤）
  const [activeQueue, setActiveQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 清理模式: 'all' (全部) | 'month' (按月) | 'screenshot' (截图) | 'video' (视频)
  const [cleanMode, setCleanMode] = useState('all');
  const [selectedMonthKey, setSelectedMonthKey] = useState(''); // 例如 '2026年9月'

  // 待删回收箱暂存区（解决每次滑动都弹系统删除窗的痛点）
  const [pendingDeletions, setPendingDeletions] = useState([]);
  const [recycleModalVisible, setRecycleModalVisible] = useState(false);

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
        showToast('相册为空，已载入演示相片 🍃', 'info');
      }

      setAllPhotos(mediaItems);
      await loadAlbums();
      showToast(`已加载 ${mediaItems.length} 项相册文件 🍃`, 'success');
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

  // 根据当前选择的模式更新 activeQueue
  useEffect(() => {
    let filtered = [];
    if (cleanMode === 'all') {
      filtered = allPhotos;
    } else if (cleanMode === 'month') {
      const found = monthGroups.find(g => g.key === selectedMonthKey);
      filtered = found ? found.photos : allPhotos;
    } else if (cleanMode === 'screenshot') {
      // 截图筛选: 文件名含 screenshot/截屏/screenshot
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
    setActiveQueue(filtered);
    setCurrentIndex(0);
    setHistory([]);
  }, [allPhotos, cleanMode, selectedMonthKey, monthGroups]);

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

  // 执行核心动作（显式传递 targetPhoto 彻底杜绝卡片错位与索引漂移）
  const handleAction = async (action, targetPhoto = null, targetAlbum = null) => {
    const idx = currentIndexRef.current;
    const currentPhoto = targetPhoto || activeQueueRef.current[idx];
    if (!currentPhoto) return;

    triggerHaptic(action);

    // 记录历史供撤销
    setHistory(prev => [...prev, { photo: currentPhoto, action, album: targetAlbum, index: idx }]);

    // 1. 左滑：加入待删除回收箱（不打断手势，避免频繁弹窗）
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
          // 降级复制模式
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

  // 卡片划走动画（显式接收 targetPhoto 确保当前划走的卡片与底层操作对象一致）
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

  // 撤销上一步（Undo）
  const handleUndo = () => {
    if (history.length === 0 || currentIndex === 0) {
      showToast('当前没有可撤销的操作 🐱', 'info');
      return;
    }
    const lastOp = history[history.length - 1];
    // 若上一张是放入待删箱，则将其从待删箱移出
    if (lastOp.action === 'delete') {
      setPendingDeletions(prev => prev.filter(p => p.id !== lastOp.photo.id));
    }

    setHistory(prev => prev.slice(0, -1));
    setCurrentIndex(prev => prev - 1);
    position.setValue({ x: 0, y: 0 });
    showToast('↩️ 已撤回上一张照片', 'info');
  };

  // 移入系统相册回收站（【🗑️PhotoSwipe-相册回收站】相册，在手机自带相册中随时可见可找回）
  const handleMoveToTrashAlbum = async () => {
    if (pendingDeletions.length === 0) return;

    const realAssets = pendingDeletions.filter(p => !String(p.id).startsWith('demo-'));
    if (realAssets.length === 0) {
      setPendingDeletions([]);
      setRecycleModalVisible(false);
      showToast('🗑 [演示] 已移入系统相册回收站', 'success');
      return;
    }

    try {
      setLoading(true);
      const ids = realAssets.map(p => p.id || p);
      let trashAlbum = await MediaLibrary.getAlbumAsync(TRASH_ALBUM);
      if (!trashAlbum) {
        trashAlbum = await MediaLibrary.createAlbumAsync(TRASH_ALBUM, ids[0], false);
        if (ids.length > 1) {
          await MediaLibrary.addAssetsToAlbumAsync(ids.slice(1), trashAlbum, false);
        }
      } else {
        await MediaLibrary.addAssetsToAlbumAsync(ids, trashAlbum, false);
      }
      await loadAlbums();
      showToast(`📦 成功将 ${pendingDeletions.length} 张照片移入手机【${TRASH_ALBUM}】相册！`, 'success');

      // 从当前工作队列中剔除
      const deletedIdSet = new Set(pendingDeletions.map(p => p.id));
      setAllPhotos(prev => prev.filter(p => !deletedIdSet.has(p.id)));
      setPendingDeletions([]);
      setRecycleModalVisible(false);
    } catch (err) {
      console.log('移入回收站相册失败:', err);
      try {
        let trashAlbum = await MediaLibrary.getAlbumAsync(TRASH_ALBUM);
        if (trashAlbum) {
          const ids = realAssets.map(p => p.id || p);
          await MediaLibrary.addAssetsToAlbumAsync(ids, trashAlbum, true);
          showToast(`📦 已移入手机【${TRASH_ALBUM}】相册`, 'success');
          const deletedIdSet = new Set(pendingDeletions.map(p => p.id));
          setAllPhotos(prev => prev.filter(p => !deletedIdSet.has(p.id)));
          setPendingDeletions([]);
          setRecycleModalVisible(false);
        }
      } catch (err2) {
        showToast('⚠️ 移入相册回收站失败，请检查写入权限', 'warn');
      }
    } finally {
      setLoading(false);
    }
  };

  // 一键彻底清空/永久粉碎待删箱（只弹一次系统原生授权对话框，彻底物理释放存储空间）
  const handleConfirmBatchDelete = async () => {
    if (pendingDeletions.length === 0) return;

    const realAssets = pendingDeletions.filter(p => !String(p.id).startsWith('demo-'));
    if (realAssets.length === 0) {
      setPendingDeletions([]);
      setRecycleModalVisible(false);
      showToast('🗑 [演示] 已彻底清空待删除照片', 'success');
      return;
    }

    try {
      setLoading(true);
      const idsToDelete = realAssets.map(p => p.id || p);
      const isSuccess = await MediaLibrary.deleteAssetsAsync(idsToDelete);
      if (isSuccess) {
        showToast(`🎉 成功永久释放 ${pendingDeletions.length} 张照片空间！`, 'success');
        // 从全量列表中移除已删除项
        const deletedIdSet = new Set(pendingDeletions.map(p => p.id));
        setAllPhotos(prev => prev.filter(p => !deletedIdSet.has(p.id)));
        setPendingDeletions([]);
        setRecycleModalVisible(false);
      } else {
        showToast('⚠️ 未确认授权删除', 'info');
      }
    } catch (err) {
      console.log('批量删除取消或异常:', err);
      showToast('⚠️ 删除操作已取消或失败', 'warn');
    } finally {
      setLoading(false);
    }
  };

  // 从待删箱移出单张照片
  const handleRemoveFromTrash = (photoId) => {
    setPendingDeletions(prev => prev.filter(p => p.id !== photoId));
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
            // ⬆ 上滑：收藏喜欢
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
            <Text style={styles.brandEmoji}>🍃</Text>
          </View>
          <View>
            <View style={styles.brandRow}>
              <Text style={styles.brandTitle}>轻相册</Text>
              <View style={styles.brandTag}>
                <Text style={styles.brandTagText}>PhotoSwipe</Text>
              </View>
            </View>
            <Text style={styles.brandSubtitle}>滑动整理 · 让相册轻一点</Text>
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

      {/* 清理模式快捷选项卡 (致敬《轻相册》时间线与分类胶囊) */}
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
            <Text style={styles.emptyTip}>正在扫描整理相册...</Text>
          </View>
        ) : isCompleted ? (
          /* 当前阶段全部整理完成卡片 */
          <View style={styles.completedCard}>
            <Text style={styles.completedEmoji}>🎉</Text>
            <Text style={styles.completedTitle}>当前相册已整理完毕！</Text>
            <Text style={styles.completedSubtitle}>
              本次共审阅了 {activeQueue.length} 项，待删箱暂存了 {pendingDeletions.length} 张照片
            </Text>

            {pendingDeletions.length > 0 && (
              <TouchableOpacity
                style={styles.oneClickDeleteBtn}
                onPress={() => setRecycleModalVisible(true)}
              >
                <Text style={styles.oneClickDeleteBtnText}>🚀 前往待删箱一键永久释放</Text>
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
              onPress={() => { setCurrentIndex(0); setHistory([]); }}
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
            <Text style={styles.emptyEmoji}>🍃</Text>
            <Text style={styles.emptyTip}>当前分类没有找到照片哦</Text>
          </View>
        )}
      </View>

      {/* 底部 5 大核心操作按钮 (支持一键撤销、手势或点按操作) */}
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

      {/* 弹窗 1：待删除回收箱审阅弹窗 (集中审阅与一次性批量清除) */}
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
                <TouchableOpacity
                  style={styles.moveToTrashAlbumBtn}
                  onPress={handleMoveToTrashAlbum}
                  activeOpacity={0.8}
                >
                  <Text style={styles.moveToTrashAlbumBtnText}>
                    📥 移入系统相册【回收站】({pendingDeletions.length}张 · 随时可找回)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.clearAllBtn}
                  onPress={handleConfirmBatchDelete}
                  activeOpacity={0.8}
                >
                  <Text style={styles.clearAllBtnText}>
                    🔥 彻底永久删除释放空间 (不可恢复)
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* 弹窗 2：月份时间线选择抽屉 */}
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

      {/* 弹窗 3：收纳相册抽屉 */}
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
    color: '#EF4444'
  },
  refreshIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3
  },
  refreshIconText: {
    fontSize: 16
  },
  modeTabsWrapper: {
    marginTop: 4,
    marginBottom: 4
  },
  modeTabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 4
  },
  modeTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  modeTabActive: {
    backgroundColor: '#10B981',
    borderColor: '#059669'
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569'
  },
  modeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginVertical: 4
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
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B'
  },
  toastContainer: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 999,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6
  },
  toastInfo: {
    backgroundColor: '#334155'
  },
  toastSuccess: {
    backgroundColor: '#059669'
  },
  toastWarn: {
    backgroundColor: '#DC2626'
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
    marginVertical: 6
  },
  deckContainer: {
    width: SCREEN_WIDTH - 32,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12
  },
  bottomCard: {
    zIndex: 1,
    elevation: 2
  },
  cardImage: {
    width: '100%',
    flex: 1,
    backgroundColor: '#F1F5F9'
  },
  cardInfoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#F1F5F9'
  },
  cardDateText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B'
  },
  cardDimText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2
  },
  gestureIndicatorPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#ECFDF5'
  },
  gestureIndicatorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669'
  },
  badge: {
    position: 'absolute',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
    zIndex: 10
  },
  likeBadge: {
    top: 30,
    alignSelf: 'center',
    borderColor: '#F43F5E',
    backgroundColor: 'rgba(255, 241, 242, 0.95)'
  },
  albumBadge: {
    bottom: 80,
    alignSelf: 'center',
    borderColor: '#0284C7',
    backgroundColor: 'rgba(240, 249, 255, 0.95)'
  },
  deleteBadge: {
    top: 40,
    right: 30,
    borderColor: '#EF4444',
    backgroundColor: 'rgba(254, 242, 242, 0.95)'
  },
  keepBadge: {
    top: 40,
    left: 30,
    borderColor: '#10B981',
    backgroundColor: 'rgba(236, 253, 245, 0.95)'
  },
  badgeText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A'
  },
  actionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8
  },
  toolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#F8FAFC',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4
  },
  undoBtn: {
    backgroundColor: '#F1F5F9'
  },
  deleteBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1
  },
  albumBtn: {
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
    borderWidth: 1
  },
  keepBtn: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1
  },
  likeBtn: {
    backgroundColor: '#FFE4E6',
    borderColor: '#FECDD3',
    borderWidth: 1
  },
  btnDisabled: {
    opacity: 0.35
  },
  toolBtnEmoji: {
    fontSize: 20
  },
  toolBtnLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
    color: '#475569'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyEmoji: {
    fontSize: 54,
    marginBottom: 10
  },
  emptyTip: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600'
  },
  completedCard: {
    width: SCREEN_WIDTH - 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8
  },
  completedEmoji: {
    fontSize: 56,
    marginBottom: 12
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
    marginBottom: 20
  },
  oneClickDeleteBtn: {
    width: '100%',
    paddingVertical: 14,
    backgroundColor: '#EF4444',
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12
  },
  oneClickDeleteBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800'
  },
  switchOtherMonthBtn: {
    width: '100%',
    paddingVertical: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10B981',
    marginBottom: 10
  },
  switchOtherMonthBtnText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '700'
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
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end'
  },
  recycleModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: SCREEN_HEIGHT * 0.8
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  modalHeaderTitle: {
    fontSize: 19,
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
    padding: 4
  },
  recycleEmptyBox: {
    paddingVertical: 40,
    alignItems: 'center'
  },
  recycleEmptyEmoji: {
    fontSize: 48,
    marginBottom: 8
  },
  recycleEmptyText: {
    fontSize: 13,
    color: '#94A3B8'
  },
  recycleGrid: {
    maxHeight: SCREEN_HEIGHT * 0.45
  },
  recycleGridItem: {
    flex: 1 / 3,
    aspectRatio: 1,
    margin: 4,
    borderRadius: 12,
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
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8
  },
  restoreItemBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700'
  },
  recycleFooter: {
    marginTop: 14
  },
  moveToTrashAlbumBtn: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4
  },
  moveToTrashAlbumBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  },
  clearAllBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: 'center'
  },
  clearAllBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700'
  },
  monthModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: SCREEN_HEIGHT * 0.7
  },
  monthOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    marginBottom: 8
  },
  monthOptionRowActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#34D399',
    borderWidth: 1.5
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 12
  },
  monthCountBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  albumModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: SCREEN_HEIGHT * 0.75
  },
  newAlbumBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14
  },
  newAlbumInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 13,
    color: '#1E293B',
    marginRight: 8
  },
  newAlbumBtn: {
    height: 44,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9'
  },
  albumItemEmoji: {
    fontSize: 22,
    marginRight: 12
  },
  albumItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B'
  },
  albumItemCount: {
    fontSize: 11,
    color: '#94A3B8'
  },
  albumItemArrow: {
    fontSize: 20,
    color: '#CBD5E1'
  }
});
